import { NextResponse } from "next/server";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import { getOfficeCompanyIdentity } from "@/lib/office/company-identity-server";

export async function GET() {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) {
    return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let companyIdentity = null;
  try { companyIdentity = await getOfficeCompanyIdentity(context.identity.userId); } catch { /* metadata remains non-blocking */ }

  return NextResponse.json(
    {
      authenticated: true,
      email: context.identity.email,
      roles: context.identity.roles,
      access_status: context.identity.accessStatus,
      company_identity: companyIdentity,
      aal: context.identity.aal,
      next_aal: context.identity.aal === "aal2" ? "aal2" : "aal2",
      founder: context.identity.founder === true,
      display_role: context.identity.displayRole,
      mfa: { enrolled: context.mfa.enrolled, factor_ids: context.mfa.enrolled ? ["totp"] : [] },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
