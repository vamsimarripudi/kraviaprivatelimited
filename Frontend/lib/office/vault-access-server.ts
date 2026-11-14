import "server-only";

import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";
import {vaultCategories} from "@/lib/office/vault-categories";

export class OfficeVaultAccessError extends Error {
 constructor(public readonly status:number,message:string){super(message);this.name="OfficeVaultAccessError";}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
const reviewPermission:Record<string,string>={
 identity:"registration.review",registrations:"registration.review",
 banking:"finance.bank.read",legal:"legal.contract.review",
 people:"people.sensitive.read",technology:"operations.asset.manage",
 documents:"document.instance.review",custody:"custody.review",
};
const sourceReadPermissions:Record<string,readonly string[]>=Object.fromEntries(
 vaultCategories.map(c=>[c.slug,c.permissions])
);
async function actor():Promise<Actor>{
 try{
  const current=await requireOfficeActor();
  if(current.identity.workspaceStatus!=="ACTIVE")throw new OfficeVaultAccessError(403,"An active Office workspace is required");
  return current;
 }catch(error){
  if(error instanceof OfficePermissionError)throw new OfficeVaultAccessError(error.status,error.message);
  throw error;
 }
}
async function permitted(current:Actor,code:string){
 const deviceId=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
 const company=await resolveOfficePermission(current.admin,current.identity,code,{type:"COMPANY"},deviceId);
 if(company.allowed)return true;
 const own=await resolveOfficePermission(current.admin,current.identity,code,{type:"OWN",ownerUserId:current.identity.userId},deviceId);
 return own.allowed;
}
async function reviewerCategories(current:Actor){
 if(!await permitted(current,"access.profile.assign"))return [];
 const checks=await Promise.all(Object.keys(reviewPermission).map(async category=>
   await permitted(current,reviewPermission[category])?category:null));
 return checks.filter((value):value is string=>value!==null);
}
type RequestRow={id:string;category_slug:string;resource_id:string|null;action:string;justification:string;
 status:string;requester_user_id:string;requested_until:string;review_note:string|null;created_at:string;decided_at:string|null};
type GrantRow={id:string;category_slug:string;resource_id:string|null;action:string;grantee_user_id:string;
 expires_at:string;granted_by:string;granted_at:string;revoked_at:string|null};

export async function getOfficeVaultAccessCenter(){
 const current=await actor();
 const reviewCategories=await reviewerCategories(current);
 const [own,review,ownGrants,reviewGrants]=await Promise.all([
  current.admin.from("office_vault_access_requests").select(
   "id,category_slug,resource_id,action,justification,status,requester_user_id,requested_until,review_note,created_at,decided_at"
   ).eq("requester_user_id",current.identity.userId).order("created_at",{ascending:false}).limit(150),
  reviewCategories.length?current.admin.from("office_vault_access_requests").select(
   "id,category_slug,resource_id,action,justification,status,requester_user_id,requested_until,review_note,created_at,decided_at"
   ).eq("status","PENDING").in("category_slug",reviewCategories).order("created_at",{ascending:false}).limit(150):
   Promise.resolve({data:[],error:null}),
  current.admin.from("office_vault_access_grants").select(
   "id,category_slug,resource_id,action,grantee_user_id,expires_at,granted_by,granted_at,revoked_at"
   ).eq("grantee_user_id",current.identity.userId).order("granted_at",{ascending:false}).limit(150),
  reviewCategories.length?current.admin.from("office_vault_access_grants").select(
   "id,category_slug,resource_id,action,grantee_user_id,expires_at,granted_by,granted_at,revoked_at"
   ).in("category_slug",reviewCategories).is("revoked_at",null).order("granted_at",{ascending:false}).limit(150):
   Promise.resolve({data:[],error:null}),
 ]);
 if(own.error||review.error||ownGrants.error||reviewGrants.error)
  throw new OfficeVaultAccessError(503,"Vault access authority is temporarily unavailable");
 return {
  generated_at:new Date().toISOString(),
  actor_user_id:current.identity.userId,
  request_categories:Object.keys(reviewPermission),
  reviewer_categories:reviewCategories,
  my_requests:(own.data??[]) as RequestRow[],
  review_queue:(review.data??[]) as RequestRow[],
  my_grants:(ownGrants.data??[]) as GrantRow[],
  administered_grants:(reviewGrants.data??[]) as GrantRow[],
 };
}
export async function requestOfficeVaultAccess(input:{category:string;recordId?:string;action:string;justification:string;until:string}){
 const current=await actor();
 if(!Object.hasOwn(reviewPermission,input.category))throw new OfficeVaultAccessError(400,"Unsupported category");
 const {data,error}=await current.admin.rpc("office_vault_request_access",{
  p_actor:current.identity.userId,p_category:input.category,p_resource:input.recordId??null,
  p_action:input.action,p_justification:input.justification,p_until:input.until,
 });
 if(error||typeof data!=="string")throw new OfficeVaultAccessError(400,error?.message||"Access request was not recorded");
 return {request_id:data};
}
export async function reviewOfficeVaultAccess(input:{requestId:string;approve:boolean;note:string}){
 const current=await actor();
 const categories=await reviewerCategories(current);
 if(!categories.length)throw new OfficeVaultAccessError(403,"Independent access-review permission is required");
 const {data:request,error}=await current.admin.from("office_vault_access_requests")
  .select("id,category_slug,requester_user_id,status").eq("id",input.requestId).maybeSingle();
 if(error)throw new OfficeVaultAccessError(503,"Review authority is temporarily unavailable");
 if(!request||request.status!=="PENDING"||!categories.includes(request.category_slug)||
 request.requester_user_id===current.identity.userId)
  throw new OfficeVaultAccessError(404,"Review item not available");
 const {data,error:writeError}=await current.admin.rpc("office_vault_review_access",{
  p_actor:current.identity.userId,p_request:input.requestId,p_approve:input.approve,p_note:input.note,
 });
 if(writeError||typeof data!=="string")throw new OfficeVaultAccessError(409,writeError?.message||"Review not committed");
 return {status:data};
}
export async function revokeOfficeVaultAccess(input:{grantId:string;reason:string}){
 const current=await actor();
 const categories=await reviewerCategories(current);
 if(!categories.length)throw new OfficeVaultAccessError(403,"Scoped revocation authority is required");
 const {data:grant,error}=await current.admin.from("office_vault_access_grants")
  .select("id,category_slug,revoked_at").eq("id",input.grantId).maybeSingle();
 if(error)throw new OfficeVaultAccessError(503,"Grant authority is temporarily unavailable");
 if(!grant||grant.revoked_at||!categories.includes(grant.category_slug))
  throw new OfficeVaultAccessError(404,"Grant unavailable");
 const {data,error:writeError}=await current.admin.rpc("office_vault_revoke_access",{
  p_actor:current.identity.userId,p_grant:input.grantId,p_reason:input.reason,
 });
 if(writeError||data!==true)throw new OfficeVaultAccessError(409,writeError?.message||"Revocation not committed");
 return {revoked:true};
}
export async function requireOfficeVaultRecord(input:{category:string;recordId:string;action:"READ"|"PREVIEW"|"DOWNLOAD"}){
 const current=await actor();
 if(!Object.hasOwn(sourceReadPermissions,input.category)||
   !sourceReadPermissions[input.category]?.length)
  throw new OfficeVaultAccessError(404,"Resource unavailable");
 // A Vault grant is additive, never an alternative to current source authority.
 const sourceDecisions=await Promise.all(sourceReadPermissions[input.category].map(code=>permitted(current,code)));
 if(!sourceDecisions.some(Boolean))throw new OfficeVaultAccessError(404,"Resource unavailable");
 const {data,error}=await current.admin.from("office_vault_access_grants").select(
  "id,category_slug,resource_id,action,expires_at,revoked_at"
 ).eq("grantee_user_id",current.identity.userId).eq("category_slug",input.category)
 .is("revoked_at",null).gt("expires_at",new Date().toISOString()).limit(250);
 if(error)throw new OfficeVaultAccessError(503,"Record access authority is unavailable");
 const validActions=input.action==="READ"?["READ","PREVIEW","DOWNLOAD"]:
  input.action==="PREVIEW"?["PREVIEW","DOWNLOAD"]:["DOWNLOAD"];
 const grant=(data??[]).find(row=>(row.resource_id===null||row.resource_id===input.recordId)&&validActions.includes(row.action));
 if(!grant)throw new OfficeVaultAccessError(404,"Resource unavailable");
 const {error:auditError}=await current.admin.from("office_vault_access_events").insert({
  grant_id:grant.id,actor_user_id:current.identity.userId,category_slug:input.category,
  resource_id:input.recordId,event_type:input.action==="DOWNLOAD"?"DOCUMENT_DOWNLOAD":"RECORD_READ",
 });
 if(auditError)throw new OfficeVaultAccessError(503,"Sensitive access cannot proceed without an audit record");
 return {actor:current.identity.userId,grantId:grant.id};
}


export async function getOfficeVaultGrantedResources(category:string){
 const current=await actor();
 if(!Object.hasOwn(sourceReadPermissions,category))
  throw new OfficeVaultAccessError(404,"Resource unavailable");
 const candidatePermissions=sourceReadPermissions[category]??[];
 const decisions=await Promise.all(candidatePermissions.map(code=>permitted(current,code)));
 if(!decisions.some(Boolean))throw new OfficeVaultAccessError(404,"Resource unavailable");
 const {data,error}=await current.admin.from("office_vault_access_grants")
   .select("resource_id,action,expires_at").eq("grantee_user_id",current.identity.userId)
   .eq("category_slug",category).is("revoked_at",null)
   .gt("expires_at",new Date().toISOString()).limit(500);
 if(error)throw new OfficeVaultAccessError(503,"Vault access grants temporarily unavailable");
 return (data??[]).filter(row=>["READ","PREVIEW","DOWNLOAD"].includes(row.action)).map(row=>row.resource_id);
}


export async function withdrawOfficeVaultAccess(requestId:string){
 const current=await actor();
 const {data,error}=await current.admin.rpc("office_vault_withdraw_access",{
  p_actor:current.identity.userId,p_request:requestId,
 });
 if(error||data!==true)throw new OfficeVaultAccessError(409,"Withdrawal was not confirmed");
 return {withdrawn:true};
}


export async function getOfficeVaultAllowedActions(category:string,recordId:string){
 const current=await actor();
 const sources=sourceReadPermissions[category];
 if(!sources?.length)throw new OfficeVaultAccessError(404,"Resource unavailable");
 const decisions=await Promise.all(sources.map(code=>permitted(current,code)));
 if(!decisions.some(Boolean))throw new OfficeVaultAccessError(404,"Resource unavailable");
 const {data,error}=await current.admin.from("office_vault_access_grants")
  .select("resource_id,action").eq("grantee_user_id",current.identity.userId)
  .eq("category_slug",category).is("revoked_at",null)
  .gt("expires_at",new Date().toISOString()).limit(250);
 if(error)throw new OfficeVaultAccessError(503,"Grant authority unavailable");
 const actions=new Set<string>();
 for(const grant of data??[]){
  if(grant.resource_id!==null&&grant.resource_id!==recordId)continue;
  actions.add("READ");
  if(grant.action==="PREVIEW"||grant.action==="DOWNLOAD")actions.add("PREVIEW");
  if(grant.action==="DOWNLOAD")actions.add("DOWNLOAD");
 }
 return {read:actions.has("READ"),preview:actions.has("PREVIEW"),download:actions.has("DOWNLOAD")};
}
