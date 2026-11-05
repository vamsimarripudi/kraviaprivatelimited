import "server-only";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";

export async function requireResourceOwner() {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity) ||
      context.identity.aal !== "aal2" || !context.identity.roles.includes("OWNER")) {
    return null;
  }
  return context.identity;
}
