import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeSessionContext, officeIdentityIsProvisioned, requestInvitedOfficeEmailOtp, verifyInvitedOfficeEmailOtp, OfficeApiError } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request") }),
  z.object({
    action: z.literal("verify"),
    challenge_id: z.string().uuid(),
    challenge_token: z.string().min(64).max(256),
    code: z.string().regex(/^\d{6}$/),
  }),
]);

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin email verification is forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid verification request" }, { status: 400 });
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity) || context.identity.aal !== "aal1") {
    return NextResponse.json({ detail: "Sign in with the invited account password first" }, { status: 401 });
  }
  try {
    const value = parsed.data.action === "request"
      ? await requestInvitedOfficeEmailOtp(context)
      : await verifyInvitedOfficeEmailOtp(context, parsed.data);
    return NextResponse.json(value, { headers: { "Cache-Control": "private, no-store", "Pragma": "no-cache" } });
  } catch (error) {
    const code = error instanceof OfficeApiError ? error.status : 503;
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Email verification unavailable" },
      { status: code >= 400 && code <= 599 ? code : 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
