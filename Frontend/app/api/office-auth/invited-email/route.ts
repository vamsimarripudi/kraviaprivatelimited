import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeSessionContext, officeIdentityIsProvisioned, requestInvitedWebEmailOtp, verifyInvitedWebEmailOtp, OfficeApiError } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request") }),
  z.object({ action: z.literal("verify"),
    challenge_id: z.string().uuid(),
    challenge_token: z.string().min(32).max(256),
    code: z.string().regex(/^\d{6}$/),
  }),
]);

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin verification is not allowed" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid email verification request" }, { status: 400 });
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity) || context.identity.aal !== "aal1") {
    return NextResponse.json({ detail: "Sign in to the invited Office account first" }, { status: 401 });
  }
  try {
    const result = parsed.data.action === "request"
      ? await requestInvitedWebEmailOtp(context)
      : await verifyInvitedWebEmailOtp(context, parsed.data);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeApiError ? error.status : 503;
    const detail = error instanceof Error ? error.message : "Employee email verification is unavailable";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
