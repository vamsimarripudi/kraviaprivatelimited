import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  founderBootstrapStatus,
  invitationStatus,
  OfficeApiError,
  registerFounder,
  registerInvitedOfficeUser,
} from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { founderBootstrapIsPermitted } from "@/lib/office/bootstrap";

const founderSchema = z.object({
  mode: z.literal("founder"),
  email: z.string().trim().email().max(254),
  display_name: z.string().trim().min(2).max(160),
  password: z.string().min(12).max(256),
});

const inviteSchema = z.object({
  mode: z.literal("invite"),
  token: z.string().min(32).max(512),
  display_name: z.string().trim().min(2).max(160),
  password: z.string().min(12).max(256),
});

const schema = z.discriminatedUnion("mode", [founderSchema, inviteSchema]);

function safe(context: Awaited<ReturnType<typeof registerFounder>>) {
  return {
    authenticated: true,
    email: context.identity.email,
    roles: context.identity.roles,
    access_status: context.identity.accessStatus,
    aal: context.identity.aal,
    founder: context.identity.founder === true,
    display_role: context.identity.displayRole,
    mfa: { enrolled: context.mfa.enrolled },
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("invite");
    if (token) return NextResponse.json({ mode: "invite", invitation: await invitationStatus(token) }, { headers: { "Cache-Control": "no-store" } });
    const bootstrap = founderBootstrapIsPermitted() ? await founderBootstrapStatus() : { registration_open: false };
    return NextResponse.json({ mode: "founder", bootstrap }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Registration status is unavailable" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Office registration is not allowed" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid Office registration request" }, { status: 400 });

  if (parsed.data.mode === "founder" && !founderBootstrapIsPermitted()) {
    return NextResponse.json({ detail: "Founder registration is not available" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const context = parsed.data.mode === "founder"
      ? await registerFounder({
          email: parsed.data.email,
          display_name: parsed.data.display_name,
          password: parsed.data.password,
        })
      : await registerInvitedOfficeUser({
          token: parsed.data.token,
          display_name: parsed.data.display_name,
          password: parsed.data.password,
        });
    return NextResponse.json(safe(context), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Office registration failed";
    const closed = /closed|already registered|already used/i.test(detail);
    const status = error instanceof OfficeApiError
      ? error.status
      : closed
        ? 409
        : 500;
    return NextResponse.json(
      { detail },
      { status: status >= 400 && status <= 599 ? status : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
