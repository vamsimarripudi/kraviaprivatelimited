import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";
import { readOfficeRuntimeResult } from "@/lib/office/runtime-read-server";

export class OfficeTrustError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeTrustError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeTrustError(error.status,error.message);
    throw error;
  }
}
async function can(current:Actor,code:string){
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  return (await resolveOfficePermission(current.admin,current.identity,code,{type:"COMPANY"},device)).allowed;
}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeTrustError(503,error.message||message)}

export async function getTrustCenter(){
  const current=await actor();
  const capabilities={
    vendor_read:await can(current,"vendor.assurance.read"),
    vendor_manage:await can(current,"vendor.assurance.manage"),
    vendor_review:await can(current,"vendor.assurance.review"),
    customer_read:await can(current,"customer.trust.read"),
    customer_manage:await can(current,"customer.trust.manage"),
    customer_review:await can(current,"customer.trust.review"),
  };
  if(!Object.values(capabilities).some(Boolean))throw new OfficeTrustError(403,"Trust Center is not assigned to your current authority");

  const [vendors,assessments,customers,requests,people]=await Promise.all([
    capabilities.vendor_read
      ? readOfficeRuntimeResult<Array<Record<string,unknown>>>("vendors").then((result)=>({...result,data:(result.data??[]).slice(0,500).sort((a,b)=>String(a.legal_name||"").localeCompare(String(b.legal_name||"")))}))
      : Promise.resolve({data:[] as Array<Record<string,unknown>>,error:null}),
    capabilities.vendor_read
      ? current.admin.from("office_vendor_assessments").select("id,assessment_code,vendor_id,assessment_type,scope_summary,risk_level,evidence_reference,remediation_summary,owner_user_id,status,expires_on,created_by,reviewed_by,reviewed_at,review_note,created_at,updated_at").order("created_at",{ascending:false}).limit(1500)
      : Promise.resolve({data:[],error:null}),
    capabilities.customer_read
      ? readOfficeRuntimeResult<Array<Record<string,unknown>>>("customers").then((result)=>({...result,data:(result.data??[]).slice(0,500).sort((a,b)=>String(a.display_name||"").localeCompare(String(b.display_name||"")))}))
      : Promise.resolve({data:[] as Array<Record<string,unknown>>,error:null}),
    capabilities.customer_read
      ? current.admin.from("office_customer_trust_requests").select("id,trust_code,customer_id,request_type,title,request_summary,owner_user_id,due_at,status,response_reference,evidence_reference,sent_reference,created_by,reviewed_by,reviewed_at,review_note,sent_at,closed_at,created_at,updated_at").order("created_at",{ascending:false}).limit(2000)
      : Promise.resolve({data:[],error:null}),
    capabilities.vendor_manage||capabilities.vendor_review||capabilities.customer_manage||capabilities.customer_review
      ? current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name")
      : Promise.resolve({data:[],error:null}),
  ]);
  for(const result of [vendors,assessments,customers,requests,people])fail(result.error,"Trust Center records are temporarily unavailable");

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles,department:current.identity.department||null},
    capabilities,
    vendors:vendors.data||[],
    vendor_assessments:assessments.data||[],
    customers:customers.data||[],
    customer_trust_requests:requests.data||[],
    people:people.data||[],
    disclaimer:"Trust Center records evidence, review state and external references. It does not fabricate certifications, pen-test outcomes, DPA acceptance, security posture, or delivery. Canonical vendors/customers remain owned by their existing systems.",
  };
}

export async function createVendorAssessment(input:{vendorId:string;type:string;scope:string;risk:string;evidence?:string;remediation?:string;ownerUserId:string;expiresOn?:string}){
  const current=await actor();
  if(!await can(current,"vendor.assurance.manage"))throw new OfficeTrustError(403,"Vendor-assurance management permission is required");
  const {data,error}=await current.admin.rpc("office_vendor_assessment_create",{p_actor:current.identity.userId,p_vendor:input.vendorId,p_type:input.type,p_scope:input.scope,p_risk:input.risk,p_evidence:input.evidence?.trim()||null,p_remediation:input.remediation?.trim()||null,p_owner:input.ownerUserId,p_expires:input.expiresOn??null});
  if(error||typeof data!=="string")throw new OfficeTrustError(400,error?.message||"Unable to create vendor assessment");
  return {assessment_id:data};
}
export async function transitionVendorAssessment(input:{assessmentId:string;status:string;evidence?:string;remediation?:string;expiresOn?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_vendor_assessment_transition",{p_actor:current.identity.userId,p_assessment:input.assessmentId,p_status:input.status,p_evidence:input.evidence?.trim()||null,p_remediation:input.remediation?.trim()||null,p_expires:input.expiresOn??null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeTrustError(400,error?.message||"Unable to transition vendor assessment");
  return {status:data};
}
export async function createCustomerTrustRequest(input:{customerId:string;type:string;title:string;summary:string;ownerUserId:string;dueAt?:string}){
  const current=await actor();
  if(!await can(current,"customer.trust.manage"))throw new OfficeTrustError(403,"Customer-trust management permission is required");
  const {data,error}=await current.admin.rpc("office_customer_trust_create",{p_actor:current.identity.userId,p_customer:input.customerId,p_type:input.type,p_title:input.title,p_summary:input.summary,p_owner:input.ownerUserId,p_due:input.dueAt??null});
  if(error||typeof data!=="string")throw new OfficeTrustError(400,error?.message||"Unable to create customer trust request");
  return {trust_id:data};
}
export async function prepareCustomerTrust(input:{trustId:string;status:string;response?:string;evidence?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_customer_trust_prepare",{p_actor:current.identity.userId,p_trust:input.trustId,p_status:input.status,p_response:input.response?.trim()||null,p_evidence:input.evidence?.trim()||null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeTrustError(400,error?.message||"Unable to prepare customer trust response");
  return {status:data};
}
export async function reviewCustomerTrust(input:{trustId:string;status:string;note?:string}){
  const current=await actor();
  if(!await can(current,"customer.trust.review"))throw new OfficeTrustError(403,"Independent customer-trust review permission is required");
  const {data,error}=await current.admin.rpc("office_customer_trust_review",{p_actor:current.identity.userId,p_trust:input.trustId,p_status:input.status,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeTrustError(400,error?.message||"Unable to review customer trust response");
  return {status:data};
}
export async function sendCustomerTrust(input:{trustId:string;sentReference:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_customer_trust_send",{p_actor:current.identity.userId,p_trust:input.trustId,p_sent_reference:input.sentReference});
  if(error||typeof data!=="string")throw new OfficeTrustError(400,error?.message||"Unable to record customer trust delivery");
  return {status:data};
}
export async function closeCustomerTrust(input:{trustId:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_customer_trust_close",{p_actor:current.identity.userId,p_trust:input.trustId,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeTrustError(400,error?.message||"Unable to close customer trust request");
  return {status:data};
}
