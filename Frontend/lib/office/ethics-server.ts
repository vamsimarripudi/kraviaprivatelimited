import "server-only";

import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeEthicsError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeEthicsError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
async function actor():Promise<Actor>{try{return await requireOfficeActor()}catch(error){if(error instanceof OfficePermissionError)throw new OfficeEthicsError(error.status,error.message);throw error}}
async function can(current:Actor,code:string,own=false){
 const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
 const resource=own?{type:"OWN" as const,key:current.identity.userId,ownerUserId:current.identity.userId}:{type:"COMPANY" as const};
 return (await resolveOfficePermission(current.admin,current.identity,code,resource,device)).allowed;
}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeEthicsError(503,error.message||message)}

export async function getEthicsWorkspace(){
 const current=await actor();
 const caps={
  report:await can(current,"ethics.report",true),
  case_read:await can(current,"ethics.case.read"),
  case_manage:await can(current,"ethics.case.manage"),
  case_review:await can(current,"ethics.case.review"),
 };
 if(!caps.report&&!caps.case_read)throw new OfficeEthicsError(403,"Ethics channel is not assigned to your current authority");

 const ownCases=await current.admin.from("office_ethics_cases")
  .select("id,case_code,reporter_user_id,category,severity,title,report_text,reporter_evidence_reference,confidentiality_notice,status,investigator_user_id,reviewer_user_id,reporter_safe_outcome,created_at,updated_at,closed_at")
  .eq("reporter_user_id",current.identity.userId).order("created_at",{ascending:false}).limit(200);
 fail(ownCases.error,"Your ethics reports are temporarily unavailable");

 const investigatorCases=caps.case_read
  ? await current.admin.from("office_ethics_cases")
      .select("id,case_code,reporter_user_id,category,severity,title,report_text,reporter_evidence_reference,confidentiality_notice,status,investigator_user_id,reviewer_user_id,outcome_summary,reporter_safe_outcome,created_at,updated_at,closed_at")
      .order("created_at",{ascending:false}).limit(500)
  : {data:[],error:null};
 fail(investigatorCases.error,"Restricted ethics case queue is temporarily unavailable");

 const fullCaseIds=(investigatorCases.data||[]).map(row=>String(row.id));
 const ownCaseIds=(ownCases.data||[]).map(row=>String(row.id));
 const noteCaseIds=Array.from(new Set([...fullCaseIds,...ownCaseIds]));
 const notes=noteCaseIds.length
  ? await current.admin.from("office_ethics_case_notes")
      .select("id,case_id,author_user_id,visibility,note_text,evidence_reference,created_at")
      .in("case_id",noteCaseIds).order("created_at",{ascending:true}).limit(3000)
  : {data:[],error:null};
 fail(notes.error,"Ethics case correspondence is temporarily unavailable");

 const safeNotes=(notes.data||[]).filter(row=>caps.case_read||row.visibility==="REPORTER");
 let investigators:Array<Record<string,unknown>>=[];
 if(caps.case_manage||caps.case_review){
  const assignments=await current.admin.from("office_user_access_profiles")
    .select("user_id").eq("profile_code","ETHICS_INVESTIGATOR").eq("status","ACTIVE");
  fail(assignments.error,"Ethics investigator directory is temporarily unavailable");
  const ids=Array.from(new Set((assignments.data||[]).map(row=>String(row.user_id))));
  if(ids.length){
    const people=await current.admin.from("office_identity_users")
      .select("user_id,display_name,job_title,primary_department,status").in("user_id",ids).eq("status","ACTIVE").order("display_name");
    fail(people.error,"Ethics investigator directory is temporarily unavailable");
    investigators=people.data||[];
  }
 }

 return {
  actor:{user_id:current.identity.userId,roles:current.identity.roles},
  capabilities:caps,
  my_cases:ownCases.data||[],
  investigation_cases:investigatorCases.data||[],
  notes:safeNotes,
  investigators,
  disclaimer:"This channel is confidential and excluded from normal manager/HR search surfaces, but KRAVIA does not represent it as technically anonymous. Reporter identity is retained so the case can be followed and protected.",
 };
}

export async function reportEthicsCase(input:{category:string;severity:string;title:string;report:string;evidence?:string}){
 const current=await actor();
 const {data,error}=await current.admin.rpc("office_ethics_report",{p_actor:current.identity.userId,p_category:input.category,p_severity:input.severity,p_title:input.title,p_report:input.report,p_evidence:input.evidence?.trim()||null});
 if(error||typeof data!=="string")throw new OfficeEthicsError(400,error?.message||"Unable to submit ethics report");
 return {case_id:data};
}
export async function assignEthicsInvestigator(input:{caseId:string;investigatorUserId:string}){
 const current=await actor();
 if(!await can(current,"ethics.case.manage"))throw new OfficeEthicsError(403,"Ethics case management permission is required");
 const {data,error}=await current.admin.rpc("office_ethics_assign",{p_actor:current.identity.userId,p_case:input.caseId,p_investigator:input.investigatorUserId});
 if(error||data!==true)throw new OfficeEthicsError(400,error?.message||"Unable to assign ethics investigator");
 return {assigned:true};
}
export async function addEthicsNote(input:{caseId:string;visibility:string;note:string;evidence?:string}){
 const current=await actor();
 const {data,error}=await current.admin.rpc("office_ethics_note",{p_actor:current.identity.userId,p_case:input.caseId,p_visibility:input.visibility,p_note:input.note,p_evidence:input.evidence?.trim()||null});
 if(error||typeof data!=="number")throw new OfficeEthicsError(400,error?.message||"Unable to add ethics case note");
 return {note_id:data};
}
export async function transitionEthicsCase(input:{caseId:string;status:string;outcome?:string;reporterOutcome?:string}){
 const current=await actor();
 const {data,error}=await current.admin.rpc("office_ethics_transition",{p_actor:current.identity.userId,p_case:input.caseId,p_status:input.status,p_outcome:input.outcome?.trim()||null,p_reporter_outcome:input.reporterOutcome?.trim()||null});
 if(error||typeof data!=="string")throw new OfficeEthicsError(400,error?.message||"Unable to transition ethics case");
 return {status:data};
}
