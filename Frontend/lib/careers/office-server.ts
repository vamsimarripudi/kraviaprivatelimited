import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { getOfficeSessionContext } from "@/lib/office/auth-server";
import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { CareerError } from "@/lib/careers/server";

type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type Authorized=Actor & { department:string|null };
async function granted(permission:string,department?:string):Promise<Authorized> {
  let actor:Actor;
  try {actor=await requireOfficeActor();}
  catch(e){throw new CareerError(e instanceof OfficePermissionError?e.status:503,"Verified Office authentication is required");}
  const targets=[
    {type:"COMPANY" as const},
    ...(department||actor.identity.department
      ? [{type:"DEPARTMENT" as const,key:department||actor.identity.department||""}]
      : []),
  ];
  for(const target of targets){
    const decision=await resolveOfficePermission(actor.admin,actor.identity,permission,target);
    if(decision.allowed) {
      const scope = decision.source==="OWNER"||decision.scopeType==="COMPANY" ? null
        : decision.scopeKey||actor.identity.department||null;
      if(department&&scope&&scope!==department) break;
      return {...actor,department:scope};
    }
  }
  throw new CareerError(403,"Recruitment role and effective permission are required");
}
function db(error:{message?:string}|null,message:string){
  if(error)throw new CareerError(503,message);
}
export async function getCareersOfficeOverview() {
  const current=await granted("hiring.candidate.manage");
  let reqQuery=current.admin.from("office_hiring_requisitions")
    .select("id,requisition_code,position_code,department_code,status,opened_at,approved_at,openings")
    .order("created_at",{ascending:false}).limit(200);
  if(current.department)reqQuery=reqQuery.eq("department_code",current.department);
  const req=await reqQuery;
  db(req.error,"Recruitment approval records unavailable");
  const ids=(req.data??[]).map(x=>x.id);
  if(!ids.length)return {canPublish:false,canManageOnboarding:false,employeeOptions:[],requisitions:[],publications:[],applications:[],candidateActions:[],candidateConsents:[],candidateUploads:[],handoffs:[],emailEvents:[],mailPolicies:[],candidateOutbox:[],notice:"No approved requisitions in your authorized scope"};
  const [publications,apps]=await Promise.all([
    current.admin.from("office_career_publications")
      .select("id,requisition_id,slug,title,summary,description,requirements,benefits,status,expires_at,published_at,version,updated_at")
      .in("requisition_id",ids).order("updated_at",{ascending:false}).limit(200),
    current.admin.from("office_career_applications")
      .select("id,application_code,requisition_id,candidate_id,full_name,email,phone,status,verified_at,created_at,imported_at,resume_scan_status,resume_filename,communication_requested,privacy_accepted_at")
      .in("requisition_id",ids).order("created_at",{ascending:false}).limit(600),
  ]);
  db(publications.error||apps.error,"Private candidate intake is unavailable");
  const appIds=(apps.data??[]).map(a=>a.id);
  const candidateIds=(apps.data??[]).map(a=>a.candidate_id).filter((id):id is string=>Boolean(id));
  const [actions,consents,uploads,handoffs]=await Promise.all([
    appIds.length
      ? current.admin.from("office_career_candidate_actions")
        .select("id,application_id,candidate_id,offer_id,interview_id,action_type,status,typed_name,evidence_sha256,created_at")
        .in("application_id",appIds).order("created_at",{ascending:false}).limit(500)
      : Promise.resolve({data:[],error:null}),
    candidateIds.length
      ? current.admin.from("office_candidate_mail_consents")
        .select("candidate_id,status,recorded_by,verified_by,consent_reference")
        .in("candidate_id",candidateIds).limit(600)
      : Promise.resolve({data:[],error:null}),
    appIds.length
      ?current.admin.from("office_career_candidate_uploads")
        .select("id,application_id,candidate_id,document_request_id,original_filename,status,submitted_at")
        .in("application_id",appIds).order("submitted_at",{ascending:false}).limit(600)
      :Promise.resolve({data:[],error:null}),
    appIds.length
      ?current.admin.from("office_career_onboarding_handoffs")
        .select("application_id,candidate_id,offer_id,pre_onboarding_request_id,employee_user_id,status,created_at")
        .in("application_id",appIds).order("created_at",{ascending:false}).limit(600)
      :Promise.resolve({data:[],error:null}),
  ]);
  db(actions.error||consents.error||uploads.error||handoffs.error,"Candidate decisions are unavailable");
  const [emailEvents,mailPolicies,candidateOutbox]=await Promise.all([
    appIds.length
      ?current.admin.from("office_career_email_events")
        .select("id,application_id,event_type,status,created_at,completed_at")
        .in("application_id",appIds).order("created_at",{ascending:false}).limit(600)
      :Promise.resolve({data:[],error:null}),
    current.admin.from("office_lifecycle_mail_policy")
      .select("event_code,source_ready,enabled,delivery_owner,approved_at")
      .like("event_code","HIRE-%").order("event_code"),
    candidateIds.length
      ?current.admin.from("office_candidate_mail_outbox")
        .select("id,candidate_id,event_code,status,created_at,finalized_at")
        .in("candidate_id",candidateIds).order("created_at",{ascending:false}).limit(600)
      :Promise.resolve({data:[],error:null}),
  ]);
  db(emailEvents.error||mailPolicies.error||candidateOutbox.error,"Recruitment communication evidence unavailable");
  let canPublish=false;
  try {await granted("hiring.requisition.manage");canPublish=true;}
  catch (error){if(!(error instanceof CareerError&&error.status===403))throw error;}
  let canManageOnboarding=false;
  let employeeOptions:Array<{user_id:string;display_name:string;primary_department:string|null}>=[];
  try {
    const onboarding=await granted("hiring.onboarding.manage");
    canManageOnboarding=true;
    let employeeQuery=onboarding.admin.from("office_identity_users")
      .select("user_id,display_name,primary_department").eq("status","ACTIVE")
      .order("display_name").limit(150);
    if(onboarding.department)employeeQuery=employeeQuery.eq("primary_department",onboarding.department);
    const employees=await employeeQuery;
    db(employees.error,"Employee identity selector is unavailable");
    employeeOptions=employees.data||[];
  } catch (error) {
    if (!(error instanceof CareerError && error.status===403)) throw error;
  }
  return {
    canPublish,canManageOnboarding,employeeOptions,
    emailEvents:emailEvents.data||[],mailPolicies:mailPolicies.data||[],candidateOutbox:candidateOutbox.data||[],
    requisitions:req.data||[],publications:publications.data||[],
    applications:apps.data||[],candidateActions:actions.data||[],candidateConsents:consents.data||[],candidateUploads:uploads.data||[],handoffs:handoffs.data||[],
    notice:"Public applications require email verification, HR adoption, verified documents and independent hiring approvals. Applicant access never grants Office permissions.",
  };
}
export async function publishCareerJob(input:{
  requisitionId:string;slug:string;title:string;summary:string;
  description:string;requirements:string;benefits:string;expiresAt?:string|null;
}) {
  const current=await granted("hiring.requisition.manage");
  const req=await current.admin.from("office_hiring_requisitions")
    .select("id,department_code,status,approved_at,opened_at,closed_at,openings")
    .eq("id",input.requisitionId).maybeSingle();
  db(req.error,"Hiring requisition unavailable");
  if(!req.data||req.data.status!=="OPEN"||!req.data.approved_at||!req.data.opened_at||req.data.closed_at||req.data.openings<1)
    throw new CareerError(409,"An approved and currently open requisition is required");
  await granted("hiring.requisition.manage",req.data.department_code);
  const existing=await current.admin.from("office_career_publications")
    .select("id").eq("requisition_id",input.requisitionId).maybeSingle();
  db(existing.error,"Current job publication unavailable");
  const payload={
    requisition_id:input.requisitionId,slug:input.slug,title:input.title.trim(),
    summary:input.summary.trim(),description:input.description.trim(),
    requirements:input.requirements.trim(),benefits:input.benefits.trim(),
    status:"PUBLISHED",published_by:current.identity.userId,
    published_at:new Date().toISOString(),expires_at:input.expiresAt||null,
  };
  const result=existing.data
    ? await current.admin.from("office_career_publications").update(payload).eq("id",existing.data.id)
      .select("id,slug,status,version").single()
    : await current.admin.from("office_career_publications").insert(payload)
      .select("id,slug,status,version").single();
  if(result.error||!result.data)throw new CareerError(409,"Unable to publish approved vacancy");
  return result.data;
}
export async function closeCareerPublication(requisitionId:string) {
  const current=await granted("hiring.requisition.manage");
  const req=await current.admin.from("office_hiring_requisitions").select("department_code")
    .eq("id",requisitionId).maybeSingle();
  db(req.error,"Requisition unavailable");
  if(!req.data)throw new CareerError(404,"Requisition not found");
  await granted("hiring.requisition.manage",req.data.department_code);
  const result=await current.admin.from("office_career_publications")
    .update({status:"PAUSED",updated_at:new Date().toISOString()})
    .eq("requisition_id",requisitionId).eq("status","PUBLISHED").select("id").maybeSingle();
  db(result.error,"Unable to pause job listing");
  return {paused:Boolean(result.data)};
}
export async function importVerifiedCareerApplicant(applicationId:string) {
  const current=await granted("hiring.candidate.manage");
  const app=await current.admin.from("office_career_applications")
    .select("id,requisition_id,status").eq("id",applicationId).maybeSingle();
  db(app.error,"Private application unavailable");
  if(!app.data)throw new CareerError(404,"Verified application not found");
  const req=await current.admin.from("office_hiring_requisitions")
    .select("department_code").eq("id",app.data.requisition_id).maybeSingle();
  db(req.error,"Requisition assignment unavailable");
  if(!req.data)throw new CareerError(404,"Requisition not found");
  await granted("hiring.candidate.manage",req.data.department_code);
  // Single governed RPC, uses actual Office actor. Atomic and idempotent.
  const result=await current.admin.rpc("office_career_adopt_application",{
    p_actor:current.identity.userId,p_application:applicationId,
  });
  if(result.error||typeof result.data!=="string")
    throw new CareerError(409,result.error?.message||"Authorized applicant import failed");
  return {candidate_id:result.data};
}
export async function recordCareerCommunicationConsent(applicationId:string,reason:string) {
  const current=await granted("hiring.candidate.manage");
  const app=await current.admin.from("office_career_applications")
    .select("candidate_id,requisition_id,privacy_accepted_at,communication_requested,application_code,email")
    .eq("id",applicationId).maybeSingle();
  db(app.error,"Applicant consent evidence unavailable");
  if(!app.data?.candidate_id||!app.data.communication_requested)
    throw new CareerError(409,"Explicit communication request and HR import are required");
  const req=await current.admin.from("office_hiring_requisitions")
    .select("department_code").eq("id",app.data.requisition_id).maybeSingle();
  db(req.error,"Requisition scope unavailable");
  if(!req.data)throw new CareerError(404,"Requisition not found");
  await granted("hiring.candidate.manage",req.data.department_code);
  const result=await current.admin.rpc("office_candidate_mail_consent_record",{
    p_actor:current.identity.userId,p_candidate:app.data.candidate_id,
    p_reference:app.data.application_code+"; verified portal; KRAVIA-RECRUITMENT-2026-11",
    p_obtained_at:app.data.privacy_accepted_at,p_reason:reason.trim()
  });
  if(result.error||result.data!==true)throw new CareerError(409,result.error?.message||"Consent evidence could not be recorded");
  return {status:"PENDING_INDEPENDENT_REVIEW"};
}
export async function decideCareerCommunicationConsent(candidateId:string,approved:boolean,reason:string) {
  const current=await granted("hiring.offer.review");
  const app=await current.admin.from("office_career_applications")
    .select("requisition_id").eq("candidate_id",candidateId).maybeSingle();
  db(app.error,"Candidate scope unavailable");
  if(!app.data)throw new CareerError(404,"Imported public applicant not found");
  const req=await current.admin.from("office_hiring_requisitions").select("department_code")
    .eq("id",app.data.requisition_id).maybeSingle();
  db(req.error,"Requisition unavailable");
  if(!req.data)throw new CareerError(404,"Requisition not found");
  await granted("hiring.offer.review",req.data.department_code);
  const result=await current.admin.rpc("office_candidate_mail_consent_decide",{
    p_actor:current.identity.userId,p_candidate:candidateId,p_approve:approved,p_reason:reason.trim(),
  });
  if(result.error||result.data!==true)throw new CareerError(409,result.error?.message||"Independent consent review failed");
  return {status:approved?"VERIFIED":"REJECTED"};
}
export async function scanCareerResume(applicationId:string) {
  const current=await granted("hiring.candidate.manage");
  const app=await current.admin.from("office_career_applications")
    .select("candidate_id,requisition_id,resume_path,resume_sha256,resume_scan_status,resume_filename")
    .eq("id",applicationId).maybeSingle();
  db(app.error,"Resume record unavailable");
  if(!app.data?.candidate_id||!app.data.resume_path||app.data.resume_scan_status!=="QUARANTINED")
    throw new CareerError(409,"Imported candidate with quarantined resume required");
  const req=await current.admin.from("office_hiring_requisitions").select("department_code")
    .eq("id",app.data.requisition_id).maybeSingle();
  db(req.error,"Requisition scope unavailable");
  if(!req.data)throw new CareerError(404,"Requisition not found");
  await granted("hiring.candidate.manage",req.data.department_code);
  const session=await getOfficeSessionContext();
  const origin=getOfficeRuntimeOrigin();
  if(!session||session.identity.userId!==current.identity.userId||session.identity.aal!=="aal2"||!origin)
    throw new CareerError(503,"Verified file-scanning runtime or AAL2 session is unavailable");
  const obj=await current.admin.storage.from("office-career-quarantine").download(app.data.resume_path);
  if(obj.error||!obj.data)throw new CareerError(503,"Private resume could not be loaded for scanning");
  const bytes=Buffer.from(await obj.data.arrayBuffer());
  if(bytes.length<100||bytes.length>4194304||bytes.subarray(0,5).toString("ascii")!=="%PDF-")
    throw new CareerError(400,"Resume does not match its declared PDF type");
  const hash=createHash("sha256").update(bytes).digest("hex");
  if(hash!==app.data.resume_sha256)throw new CareerError(409,"Quarantined file integrity verification failed");
  let scan:Response;
  try {
    scan=await fetch(new URL("/api/v1/security/file-scan",origin),{
      method:"POST",headers:{
        Authorization:"Bearer "+session.session.access_token,
        "Content-Type":"application/pdf","Content-Length":String(bytes.length),
      },body:new Uint8Array(bytes),cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(35000),
    });
  }catch{throw new CareerError(503,"Malware scanning unavailable; resume remains quarantined");}
  if(scan.status===422) {
    await current.admin.from("office_career_applications").update({resume_scan_status:"REJECTED"})
      .eq("id",applicationId);
    throw new CareerError(400,"Resume rejected by malware scanning");
  }
  if(!scan.ok)throw new CareerError(503,"Malware scanning unavailable; resume remains quarantined");
  const proof=await scan.json().catch(()=>null) as {clean?:boolean;sha256?:string;byte_size?:number}|null;
  if(!proof?.clean||proof.sha256!==hash||proof.byte_size!==bytes.length)
    throw new CareerError(503,"Scanner result integrity mismatch");
  const safePath="resumes/"+app.data.candidate_id+"/"+randomUUID()+".pdf";
  const upload=await current.admin.storage.from("office-candidate-documents")
    .upload(safePath,bytes,{contentType:"application/pdf",upsert:false,cacheControl:"0"});
  if(upload.error)throw new CareerError(503,"Verified resume could not be placed in the recruitment vault");
  const updated=await current.admin.from("office_candidates")
    .update({resume_storage_reference:safePath,updated_at:new Date().toISOString()})
    .eq("id",app.data.candidate_id).eq("requisition_id",app.data.requisition_id);
  if(updated.error){
    await current.admin.storage.from("office-candidate-documents").remove([safePath]);
    throw new CareerError(503,"Approved resume metadata could not be attached to the candidate");
  }
  const result=await current.admin.from("office_career_applications")
    .update({resume_scan_status:"SCANNED_CLEAN"}).eq("id",applicationId);
  db(result.error,"Resume scan state was not retained");
  await current.admin.storage.from("office-career-quarantine").remove([app.data.resume_path]);
  return {status:"SCANNED_CLEAN"};
}
export async function reviewedOfferAcknowledgement(actionId:string) {
  const current=await granted("hiring.onboarding.manage");
  const a=await current.admin.from("office_career_candidate_actions")
    .select("id,application_id,candidate_id,offer_id,action_type,status,evidence_sha256,typed_name")
    .eq("id",actionId).maybeSingle();
  db(a.error,"Candidate response unavailable");
  if(!a.data||a.data.action_type!=="OFFER_ACKNOWLEDGED"||a.data.status!=="SUBMITTED"||!a.data.offer_id)
    throw new CareerError(409,"An unprocessed candidate offer response is required");
  const offer=await current.admin.from("office_offer_proposals")
    .select("id,status,candidate_id,department_code,offer_document_instance_id,valid_until")
    .eq("id",a.data.offer_id).maybeSingle();
  db(offer.error,"Approved offer unavailable");
  if(!offer.data||offer.data.candidate_id!==a.data.candidate_id||!["DOCUMENT_READY","OFFERED"].includes(offer.data.status))
    throw new CareerError(409,"Official offered document required");
  await granted("hiring.onboarding.manage",offer.data.department_code);
  if(!offer.data.offer_document_instance_id)throw new CareerError(409,"Official signed offer document missing");
  const signed=await current.admin.from("office_document_instances")
    .select("signed_at,delivered_at").eq("id",offer.data.offer_document_instance_id).maybeSingle();
  db(signed.error,"Signed offer verification unavailable");
  if(!signed.data?.signed_at||!signed.data.delivered_at)
    throw new CareerError(409,"Provider-verified signed and delivered offer is required before onboarding");
  // One atomic SQL transaction validates signed document evidence, creates the
  // governed approval and records the applicant-to-employee handoff.
  const result=await current.admin.rpc("office_career_accept_signed_offer",{
    p_actor:current.identity.userId,p_action:actionId
  });
  if(result.error||typeof result.data!=="string")
    throw new CareerError(409,result.error?.message||"Signed offer handoff could not be finalized");
  return {pre_onboarding_request_id:result.data,status:"AWAITING_INDEPENDENT_APPROVAL"};
}


/** Final employee link requires signed offer, independent onboarding approval,
 * genuine active employment, verified private intake/bank and issued employee ID. */
export async function linkVerifiedCareerEmployee(applicationId:string,employeeUserId:string) {
  const current=await granted("hiring.onboarding.manage");
  const handoff=await current.admin.from("office_career_onboarding_handoffs")
    .select("offer_id,candidate_id,pre_onboarding_request_id,status")
    .eq("application_id",applicationId).maybeSingle();
  db(handoff.error,"Onboarding handoff unavailable");
  if(!handoff.data)throw new CareerError(404,"No approved-offer handoff exists");
  const offer=await current.admin.from("office_offer_proposals")
    .select("department_code").eq("id",handoff.data.offer_id).maybeSingle();
  db(offer.error,"Offer department unavailable");
  if(!offer.data)throw new CareerError(404,"Offer not found");
  await granted("hiring.onboarding.manage",offer.data.department_code);
  const result=await current.admin.rpc("office_career_employee_link",{
    p_actor:current.identity.userId,p_application:applicationId,p_employee:employeeUserId
  });
  if(result.error||result.data!==true)
    throw new CareerError(409,result.error?.message||"Independent verified employee linkage failed");
  return {status:"EMPLOYEE_LINKED",notice:"Candidate moved to HIRED after accepted offer, approved onboarding, matching identity, verified bank and permanent ID."};
}
