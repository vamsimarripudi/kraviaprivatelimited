import "server-only";
import {OfficePermissionError,requireOfficeActor,resolveOfficePermission}
 from "@/lib/office/permission-engine";
type OfficeActor=Awaited<ReturnType<typeof requireOfficeActor>>;

/** K-Vault entry is an explicit per-identity permission, not a job-title,
 * director, department-owner or implicit OWNER bypass. An entry does NOT
 * grant any record read, download, review or scanner authorization. */
export async function requireOfficeVaultEntry(current?:OfficeActor):Promise<OfficeActor>{
 const actor=current??await requireOfficeActor();
 if(actor.identity.workspaceStatus!=="ACTIVE")
  throw new OfficePermissionError(403,"Active Office identity required");
 const verdict=await resolveOfficePermission(actor.admin,actor.identity,
   "vault.entry",{type:"COMPANY"},null);
 if(!verdict.allowed)
  throw new OfficePermissionError(403,"K-Vault entry is restricted to approved executive accounts");
 return actor;
}
