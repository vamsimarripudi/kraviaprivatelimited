import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeEmergencyContactError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeEmergencyContactError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeEmergencyContactError(error.status,error.message);
    throw error;
  }
}
async function canOwn(current:Actor){
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  return (await resolveOfficePermission(current.admin,current.identity,"people.emergency_contact.own",{type:"OWN",key:current.identity.userId,ownerUserId:current.identity.userId},device)).allowed;
}
async function canSafetyRead(current:Actor){
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  return (await resolveOfficePermission(current.admin,current.identity,"people.emergency_contact.read",{type:"COMPANY"},device)).allowed;
}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeEmergencyContactError(503,error.message||message)}

export async function getEmergencyContactOverview(){
  const current=await actor();
  const [own,safetyRead]=await Promise.all([canOwn(current),canSafetyRead(current)]);
  if(!own&&!safetyRead)throw new OfficeEmergencyContactError(403,"Emergency-contact access is not assigned");

  const ownResult=own
    ? await current.admin.from("office_emergency_contacts")
        .select("id,user_id,priority,full_name,relationship,phone_e164,email,notes,active,confirmed_at,created_at,updated_at")
        .eq("user_id",current.identity.userId).eq("active",true).order("priority")
    : {data:[],error:null};
  fail(ownResult.error,"Your emergency contacts are temporarily unavailable");

  const directoryResult=safetyRead
    ? await current.admin.from("office_emergency_contacts")
        .select("id,user_id,priority,full_name,relationship,active,confirmed_at,updated_at")
        .eq("active",true).order("user_id").order("priority").limit(5000)
    : {data:[],error:null};
  fail(directoryResult.error,"Emergency-contact directory is temporarily unavailable");

  const userIds=safetyRead
    ? [...new Set((directoryResult.data||[]).map(row=>String(row.user_id)))]
    : [];
  const people=userIds.length
    ? await current.admin.from("office_identity_users")
        .select("user_id,display_name,job_title,primary_department,status").in("user_id",userIds).order("display_name")
    : {data:[],error:null};
  fail(people.error,"Employee directory is temporarily unavailable");

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles},
    capabilities:{own,safety_read:safetyRead},
    own_contacts:ownResult.data||[],
    safety_directory:(directoryResult.data||[]).map(row=>({...row,phone_e164:null,email:null,notes:null,restricted_contact:true})),
    people:people.data||[],
    disclaimer:"Emergency contacts are private safety records. Ordinary managers, admins and executives do not inherit access. HR/safety details are revealed only on explicit request and every privileged reveal is audit-logged.",
  };
}

export async function upsertOwnEmergencyContact(input:{contactId?:string;priority:number;name:string;relationship:string;phone:string;email?:string;notes?:string;attest:boolean}){
  const current=await actor();
  if(!await canOwn(current))throw new OfficeEmergencyContactError(403,"Own emergency-contact permission is required");
  const {data,error}=await current.admin.rpc("office_emergency_contact_upsert",{
    p_actor:current.identity.userId,p_contact:input.contactId??null,p_priority:input.priority,p_name:input.name,p_relationship:input.relationship,
    p_phone:input.phone,p_email:input.email?.trim()||null,p_notes:input.notes?.trim()||null,p_attest:input.attest,
  });
  if(error||typeof data!=="string")throw new OfficeEmergencyContactError(400,error?.message||"Unable to save emergency contact");
  return {contact_id:data};
}

export async function confirmOwnEmergencyContact(contactId:string){
  const current=await actor();
  if(!await canOwn(current))throw new OfficeEmergencyContactError(403,"Own emergency-contact permission is required");
  const {data,error}=await current.admin.rpc("office_emergency_contact_confirm",{p_actor:current.identity.userId,p_contact:contactId});
  if(error||data!==true)throw new OfficeEmergencyContactError(400,error?.message||"Unable to confirm emergency contact");
  return {confirmed:true};
}

export async function deactivateOwnEmergencyContact(input:{contactId:string;reason:string}){
  const current=await actor();
  if(!await canOwn(current))throw new OfficeEmergencyContactError(403,"Own emergency-contact permission is required");
  const {data,error}=await current.admin.rpc("office_emergency_contact_deactivate",{p_actor:current.identity.userId,p_contact:input.contactId,p_reason:input.reason});
  if(error||data!==true)throw new OfficeEmergencyContactError(400,error?.message||"Unable to deactivate emergency contact");
  return {deactivated:true};
}

export async function revealEmergencyContact(contactId:string){
  const current=await actor();
  if(!await canSafetyRead(current))throw new OfficeEmergencyContactError(403,"Restricted safety access is required");
  const {data,error}=await current.admin.from("office_emergency_contacts")
    .select("id,user_id,priority,full_name,relationship,phone_e164,email,notes,confirmed_at")
    .eq("id",contactId).eq("active",true).maybeSingle();
  if(error||!data)throw new OfficeEmergencyContactError(404,"Emergency contact not found");
  const {error:auditError}=await current.admin.from("office_emergency_contact_events").insert({
    contact_id:data.id,
    actor_user_id:current.identity.userId,
    event_type:"VIEWED_BY_SAFETY",
    metadata:{purpose:"explicit_safety_contact_reveal"},
  });
  if(auditError)throw new OfficeEmergencyContactError(503,"Emergency-contact access audit is unavailable");
  return {contact:data};
}
