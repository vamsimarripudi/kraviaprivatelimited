import "server-only";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";

export class PublicPublisherError extends Error {
 constructor(public readonly status: number,message:string){super(message);}
}
/** Public resource publishing authority is independent of all visitor accounts. */
export async function requirePublicPublisher() {
 const session=await getOfficeSessionContext();
 if(!session || !officeIdentityIsProvisioned(session.identity))
  throw new PublicPublisherError(401,"KRAVIA Office sign-in is required.");
 if(session.identity.aal!=="aal2"||!session.identity.roles.includes("OWNER"))
  throw new PublicPublisherError(403,"OWNER permission and current MFA are required.");
 return session.identity;
}
