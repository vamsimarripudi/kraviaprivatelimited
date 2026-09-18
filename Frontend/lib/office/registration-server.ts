import "server-only";

import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";

export class OfficeRegistrationError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeRegistrationError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type PermissionCode="registration.read"|"registration.manage"|"registration.review";

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeRegistrationError(error.status,error.message);
    throw error;
  }
}
function roleFallback(current:Actor,code:PermissionCode){
  const roles=current.identity.roles;
  if(roles.includes("OWNER"))return true;
  if(code==="registration.read")return roles.some(role=>["DIRECTOR","CS","LEGAL","CA","AUDITOR"].includes(role));
  if(code==="registration.manage")return roles.some(role=>["DIRECTOR","CS"].includes(role));
  return roles.some(role=>["DIRECTOR","CS","LEGAL","CA"].includes(role));
}
async function allowed(current:Actor,code:PermissionCode){
  if(roleFallback(current,code))return true;
  const result=await resolveOfficePermission(current.admin,current.identity,code,{type:"COMPANY"});
  return result.allowed;
}
async function requireAllowed(current:Actor,code:PermissionCode){
  if(!await allowed(current,code))throw new OfficeRegistrationError(403,code+" permission is required");
}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeRegistrationError(503,error.message||message)}
function maskedSuffix(value:string){
  const suffix=value.toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(suffix.length<2||suffix.length>8)throw new OfficeRegistrationError(400,"Enter only the final 2–8 identifier characters");
  return "••••"+suffix;
}
async function genericAudit(current:Actor,action:string,id:string,context:Record<string,unknown>){
  const result=await current.admin.from("audit_events").insert({actor_id:current.identity.userId,action,entity_type:"OFFICE_REGISTRATION",entity_id:id,context});
  fail(result.error,"Unable to append registration audit evidence");
}

export async function getOfficeRegistrationOverview(){
  const current=await actor();await requireAllowed(current,"registration.read");
  const [registrations,events,people,manage,review]=await Promise.all([
    current.admin.from("office_company_registrations").select("id,registration_code,registration_type,title,authority,jurisdiction,identifier_masked,issued_on,expires_on,renewal_due_on,status,source_reference,evidence_reference,owner_user_id,created_by,verified_by,verified_at,review_note,created_at,updated_at").order("updated_at",{ascending:false}).limit(500),
    current.admin.from("office_registration_events").select("id,actor_user_id,registration_id,event_type,previous_status,new_status,note,metadata,created_at").order("created_at",{ascending:false}).limit(1200),
    current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name"),
    allowed(current,"registration.manage"),
    allowed(current,"registration.review"),
  ]);
  fail(registrations.error,"Registration records are temporarily unavailable");fail(events.error,"Registration history is temporarily unavailable");fail(people.error,"Office identities are temporarily unavailable");
  return {
    generated_at:new Date().toISOString(),
    actor:{user_id:current.identity.userId,roles:current.identity.roles},
    capabilities:{manage,review},
    registrations:registrations.data??[],
    events:events.data??[],
    people:people.data??[],
    disclaimer:"Registration records are operational evidence. Creation is always UNVERIFIED; independent review plus authoritative evidence is required before ACTIVE status. Only masked identifier suffixes are stored.",
  };
}

export async function createOfficeRegistration(input:{type:string;title:string;authority:string;jurisdiction:string;identifierSuffix:string;issuedOn?:string;expiresOn?:string;renewalDueOn?:string;sourceReference:string;evidenceReference?:string;ownerUserId?:string}){
  const current=await actor();await requireAllowed(current,"registration.manage");
  const masked=maskedSuffix(input.identifierSuffix);
  const {data,error}=await current.admin.rpc("office_registration_create",{p_actor:current.identity.userId,p_type:input.type,p_title:input.title,p_authority:input.authority,p_jurisdiction:input.jurisdiction||"IN",p_identifier_masked:masked,p_issued:input.issuedOn||null,p_expires:input.expiresOn||null,p_renewal:input.renewalDueOn||null,p_source:input.sourceReference,p_evidence:input.evidenceReference?.trim()||null,p_owner:input.ownerUserId||null});
  if(error||typeof data!=="string")throw new OfficeRegistrationError(400,error?.message||"Unable to create registration record");
  await genericAudit(current,"REGISTRATION_CREATED",data,{registration_type:input.type,authority:input.authority,status:"UNVERIFIED"});
  return {registration_id:data,status:"UNVERIFIED"};
}

export async function reviewOfficeRegistration(input:{registrationId:string;status:"ACTIVE"|"REJECTED";note?:string;evidenceReference?:string}){
  const current=await actor();await requireAllowed(current,"registration.review");
  const row=await current.admin.from("office_company_registrations").select("created_by").eq("id",input.registrationId).maybeSingle();
  if(row.error||!row.data)throw new OfficeRegistrationError(404,"Registration not found");
  if(row.data.created_by===current.identity.userId)throw new OfficeRegistrationError(409,"Registration creator cannot independently review the same record");
  const {data,error}=await current.admin.rpc("office_registration_review",{p_actor:current.identity.userId,p_registration:input.registrationId,p_status:input.status,p_note:input.note?.trim()||null,p_evidence:input.evidenceReference?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeRegistrationError(400,error?.message||"Unable to review registration");
  await genericAudit(current,"REGISTRATION_REVIEWED",input.registrationId,{status:data});
  return {status:data};
}

export async function updateOfficeRegistration(input:{registrationId:string;expiresOn?:string;renewalDueOn?:string;status:"ACTIVE"|"RENEWAL_DUE"|"EXPIRED"|"SUPERSEDED"|"CANCELLED";sourceReference?:string;evidenceReference?:string;ownerUserId?:string;note?:string}){
  const current=await actor();await requireAllowed(current,"registration.manage");
  const {data,error}=await current.admin.rpc("office_registration_update",{p_actor:current.identity.userId,p_registration:input.registrationId,p_expires:input.expiresOn||null,p_renewal:input.renewalDueOn||null,p_status:input.status,p_source:input.sourceReference?.trim()||null,p_evidence:input.evidenceReference?.trim()||null,p_owner:input.ownerUserId||null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeRegistrationError(400,error?.message||"Unable to update registration");
  await genericAudit(current,"REGISTRATION_UPDATED",input.registrationId,{status:data,expires_on:input.expiresOn||null,renewal_due_on:input.renewalDueOn||null});
  return {status:data};
}
