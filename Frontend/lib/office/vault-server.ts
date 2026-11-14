import "server-only";
import { requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";
import { vaultCategories, type VaultCategory } from "@/lib/office/vault-categories";
import {visibleVaultCategories} from "@/lib/office/vault-category-visibility";

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
 // A source permission alone is not a K-Vault entry grant. Only expose
 // categories where this identity has a current, unrevoked read grant.
 const grants=await current.admin.from("office_vault_access_grants")
  .select("category_slug")
  .eq("grantee_user_id",current.identity.userId)
  .is("revoked_at",null)
  .gt("expires_at",new Date().toISOString())
  .in("action",["READ","PREVIEW","DOWNLOAD"])
  .limit(1000);
 if(grants.error)throw new Error("Vault category-grant authority unavailable");
 const grantedCategories=new Set((grants.data??[]).map(row=>String(row.category_slug)));
 return {
   categories:visibleVaultCategories(vaultCategories,new Set(permitted),grantedCategories),
   allowed:permitted,
 };
}
