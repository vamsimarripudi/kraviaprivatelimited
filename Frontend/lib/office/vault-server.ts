import "server-only";
import { requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";
import { vaultCategories, type VaultCategory } from "@/lib/office/vault-categories";

export async function getOfficeVaultAccess(): Promise<{ categories: VaultCategory[]; allowed: string[] }> {
 const current=await requireOfficeActor();
 if(current.identity.workspaceStatus!=="ACTIVE") return {categories:[],allowed:[]};
 const deviceId=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
 const codes=[...new Set(vaultCategories.flatMap(row=>row.permissions).concat([
   "access.profile.assign","access.audit.read","registration.review","document.instance.review","audit.read",
 ]))];
 const allowed=await Promise.all(codes.map(async code=>{
   const company=await resolveOfficePermission(current.admin,current.identity,code,{type:"COMPANY"},deviceId);
   if(company.allowed) return code;
   const own=await resolveOfficePermission(current.admin,current.identity,code,{type:"OWN",ownerUserId:current.identity.userId},deviceId);
   return own.allowed?code:null;
 }));
 const permitted=allowed.filter((code):code is string=>code!==null);
 return {
   categories:vaultCategories.filter(row=>row.permissions.some(code=>permitted.includes(code))),
   allowed:permitted,
 };
}
