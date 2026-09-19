import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeEnvironment } from "@/lib/env/office";
import { signInOffice, signOutOffice } from "@/lib/office/auth-server";
import { beginOfficeAuthSession } from "@/lib/office/auth-session-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(256),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Office sign-in is not allowed" }, { status: 403 });
  }
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

    try {
      await beginOfficeAuthSession(request, context);
    } catch (ledgerError) {
      await signOutOffice(context);
      throw ledgerError;
    }

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
    try { await signOutOffice(null); } catch { /* cookie cleanup best effort */ }
    const code = error instanceof Error ? error.message : "UNKNOWN_SIGN_IN_FAILURE";
    console.error("[office-auth] sign-in failed", { code });

    let status = 401;
    let detail = "Unable to sign in with those credentials";
    if (code === "ACCESS_NOT_PROVISIONED") {
      status = 403;
      detail = "This company identity is not authorised for KRAVIA Office";
    } else if (code === "OFFICE_AUTHORITY_UNAVAILABLE") {
      status = 503;
      detail = "KRAVIA Office authorisation service is unavailable";
    } else if (code.includes("LEDGER_UNAVAILABLE")) {
      status = 503;
      detail = "KRAVIA Office secure session service is unavailable";
    } else if (code.includes("not configured")) {
      status = 503;
      detail = "KRAVIA Office identity configuration is unavailable";
    }

    return NextResponse.json(
      { detail },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
