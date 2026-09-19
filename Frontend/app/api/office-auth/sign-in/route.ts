import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { signInOffice } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(256),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Office sign-in is not allowed" }, { status: 403 });
  }
  if (!getOfficeRuntimeOrigin()) {
    return NextResponse.json({ detail: "KRAVIA Office identity service is not configured" }, { status: 503 });
  }
  const parsed = signInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid sign-in request" }, { status: 400 });

  try {
    const context = await signInOffice(parsed.data.email, parsed.data.password);
    return NextResponse.json(
      {
        authenticated: true,
        email: context.identity.email,
        roles: context.identity.roles,
        access_status: context.identity.accessStatus,
        aal: context.identity.aal,
        next_aal: "aal2",
        founder: context.identity.founder === true,
        display_role: context.identity.displayRole,
        mfa: { enrolled: context.mfa.enrolled, factor_ids: context.mfa.enrolled ? ["totp"] : [] },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to sign in";
    const unavailable = /runtime|service|configured|unavailable/i.test(detail);
    const locked = /temporarily locked/i.test(detail);
    return NextResponse.json(
      { detail },
      { status: unavailable ? 503 : locked ? 429 : 401, headers: { "Cache-Control": "no-store" } },
    );
  }
}
