import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeEnvironment } from "@/lib/env/office";
import { signInOffice, signOutOffice } from "@/lib/office/auth-server";

const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(256),
});

export async function POST(request: Request) {
  if (!getOfficeEnvironment()) {
    return NextResponse.json({ detail: "KRAVIA Office identity is not configured" }, { status: 503 });
  }

  const parsed = signInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid sign-in request" }, { status: 400 });

  try {
    const context = await signInOffice(parsed.data.email, parsed.data.password);
    const [{ data: aalData }, { data: factorsData }] = await Promise.all([
      context.client.auth.mfa.getAuthenticatorAssuranceLevel(),
      context.client.auth.mfa.listFactors(),
    ]);
    const verifiedTotp = (factorsData?.totp ?? []).filter((factor) => factor.status === "verified");

    return NextResponse.json(
      {
        authenticated: true,
        email: context.identity.email,
        roles: context.identity.roles,
        access_status: context.identity.accessStatus,
        aal: aalData?.currentLevel ?? context.identity.aal,
        next_aal: aalData?.nextLevel ?? context.identity.aal,
        mfa: { enrolled: verifiedTotp.length > 0, factor_ids: verifiedTotp.map((factor) => factor.id) },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Never reveal whether the email, password, role record or access status was
    // the failing component of an unauthorised sign-in.
    try { await signOutOffice(null); } catch { /* cookie cleanup best effort */ }
    const unavailable = error instanceof Error && error.message.includes("not configured");
    return NextResponse.json(
      { detail: unavailable ? "KRAVIA Office identity is not configured" : "Unable to sign in with those credentials" },
      { status: unavailable ? 503 : 401, headers: { "Cache-Control": "no-store" } },
    );
  }
}
