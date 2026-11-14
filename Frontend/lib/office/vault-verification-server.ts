import "server-only";
import {getOfficeRegistrationOverview,reviewOfficeRegistration,OfficeRegistrationError} from "@/lib/office/registration-server";
import {getOfficeVaultAccess,getOfficeVaultSourceVisibleRecordIds,getOfficeVaultGrantedResources,
 requireOfficeVaultRecord,OfficeVaultAccessError} from "@/lib/office/vault-access-server";

export class OfficeVaultVerificationError extends Error{
 constructor(public readonly status:number,message:string){super(message);this.name="OfficeVaultVerificationError";}
}
type Category="registrations"|"identity";
/** Only source-authorized, explicitly Vault-granted records enter this review
 * queue. Pending access requests and mere job titles never grant visibility. */
export async function getOfficeVaultVerificationQueue(){
 const registrations=await getOfficeRegistrationOverview();
 if(!registrations.capabilities.review)throw new OfficeVaultVerificationError(403,
  "Independent registration review permission is required");
 const sourceVisible=await getOfficeVaultSourceVisibleRecordIds("registrations",registrations.registrations);
 const grants=await Promise.all((["registrations","identity"] as const).map(async category=>{
  try{return {category,resources:await getOfficeVaultGrantedResources(category)};}
  catch(error){
   if(error instanceof OfficeVaultAccessError&&error.status===404)return {category,resources:[] as (string|null)[]};
   throw error;
  }
 }));
 const permitted=new Map<string,Category>();
 for(const row of registrations.registrations){
  if(!sourceVisible.has(row.id))continue;
  for(const {category,resources} of grants){
   if(resources.includes(null)||resources.includes(row.id)){
    permitted.set(row.id,category);break;
   }
  }
 }
 return {scope:"VAULT_GRANTED_SOURCE_REVIEWS" as const,
  generated_at:registrations.generated_at,
  actor_user_id:registrations.actor.user_id,
  items:registrations.registrations.filter(row=>row.status==="UNVERIFIED"&&
    row.created_by!==registrations.actor.user_id&&permitted.has(row.id))
   .map(row=>({id:row.id,registration_code:row.registration_code,title:row.title,
    registration_type:row.registration_type,authority:row.authority,
    identifier_masked:row.identifier_masked,source_reference:row.source_reference,
    evidence_reference:row.evidence_reference,created_at:row.created_at,
    grant_category:permitted.get(row.id)!})),
  disclaimer:"This queue includes only current source-visible UNVERIFIED registrations with an active Vault grant. The maker cannot independently approve their own record. No sensitive identifier beyond its masked suffix is exposed.",
 };
}
export async function reviewOfficeVaultRegistration(input:{
 recordId:string;decision:"ACTIVE"|"REJECTED";note:string;evidenceReference?:string;
}){
 const queue=await getOfficeVaultVerificationQueue();
 const item=queue.items.find(row=>row.id===input.recordId);
 if(!item)throw new OfficeVaultVerificationError(404,"Authorized independent review item unavailable");
 if(input.decision==="ACTIVE"&&!input.evidenceReference?.trim())
  throw new OfficeVaultVerificationError(400,"Verification requires an authoritative evidence reference");
 await requireOfficeVaultRecord({category:item.grant_category,
  recordId:input.recordId,action:"READ"});
 return reviewOfficeRegistration({
  registrationId:input.recordId,status:input.decision,
  note:input.note,evidenceReference:input.evidenceReference,
 });
}
