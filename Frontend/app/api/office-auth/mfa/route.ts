import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeSessionContext, officeIdentityIsProvisioned, writeOfficeSessionCookies } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll") }),
  z.object({ action: z.literal("challenge"), factor_id: z.string().uuid() }),
  z.object({ action: z.literal("verify"), factor_id: z.string().uuid(), challenge_id: z.string().uuid(), code: z.string().regex(/^\d{6,10}$/) }),
]);

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Office MFA request is not allowed" }, { status: 403 });
  }

  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) {
    return NextResponse.json({ detail: "Office sign-in required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid MFA request" }, { status: 400 });

  try {
    if (parsed.data.action === "enroll") {
      const { data: factors } = await context.client.auth.mfa.listFactors();
      const verified = (factors?.totp ?? []).filter((factor) => factor.status === "verified");
      if (verified.length > 0) {
        return NextResponse.json({ detail: "A verified authenticator is already enrolled" }, { status: 409 });
      }

      const { data, error } = await context.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "KRAVIA Office" });
      if (error || !data) throw error ?? new Error("MFA enrollment failed");
      return NextResponse.json(
        { factor_id: data.id, qr_code: data.totp.qr_code, friendly_name: data.friendly_name ?? "KRAVIA Office" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (parsed.data.action === "challenge") {
      const { data, error } = await context.client.auth.mfa.challenge({ factorId: parsed.data.factor_id });
      if (error || !data) throw error ?? new Error("MFA challenge failed");
      return NextResponse.json({ challenge_id: data.id }, { headers: { "Cache-Control": "no-store" } });
    }

    const { error } = await context.client.auth.mfa.verify({
      factorId: parsed.data.factor_id,
      challengeId: parsed.data.challenge_id,
      code: parsed.data.code,
    });
    if (error) throw error;

    const [{ data: aalData }, current] = await Promise.all([
      context.client.auth.mfa.getAuthenticatorAssuranceLevel(),
      context.client.auth.getSession(),
    ]);
    if (current.data.session) await writeOfficeSessionCookies(current.data.session);
    if (aalData?.currentLevel !== "aal2") {
      return NextResponse.json({ detail: "MFA verification did not reach AAL2" }, { status: 403 });
    }
    return NextResponse.json({ verified: true, aal: "aal2" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ detail: "MFA operation failed" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
