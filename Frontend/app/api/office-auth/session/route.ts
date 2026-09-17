import { NextResponse } from "next/server";
import { getOfficeSessionContext, officeIdentityIsProvisioned, writeOfficeSessionCookies } from "@/lib/office/auth-server";
import { touchOfficeAuthSession } from "@/lib/office/auth-session-server";

export async function GET(request: Request) {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) {
    return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const [{ data: aalData }, { data: factorsData }] = await Promise.all([
    context.client.auth.mfa.getAuthenticatorAssuranceLevel(),
    context.client.auth.mfa.listFactors(),
  ]);
  const verifiedTotp = (factorsData?.totp ?? []).filter((factor) => factor.status === "verified");
  const current = await context.client.auth.getSession();
  if (current.data.session) {
    try { await writeOfficeSessionCookies(current.data.session); } catch { /* no-op */ }
  }
  const currentAal = aalData?.currentLevel === "aal2" ? "aal2" : "aal1";
  try {
    await touchOfficeAuthSession(request, {
      ...context,
      session: current.data.session ?? context.session,
      identity: { ...context.identity, aal: currentAal },
    }, currentAal);
  } catch {
    /* Identity session remains authoritative; heartbeat failure is surfaced by security monitoring separately. */
  }

  return NextResponse.json(
    {
      authenticated: true,
      email: context.identity.email,
      roles: context.identity.roles,
      access_status: context.identity.accessStatus,
      aal: currentAal,
      next_aal: aalData?.nextLevel ?? context.identity.aal,
      mfa: { enrolled: verifiedTotp.length > 0, factor_ids: verifiedTotp.map((factor) => factor.id) },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
