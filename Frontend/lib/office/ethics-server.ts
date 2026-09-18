import "server-only";

import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeEthicsError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeEthicsError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type CaseRow={
  id:string;case_code:string;reporter_user_id:string;category:string;severity:string;title:string;report_text:string;
  reporter_evidence_reference:string|null;confidentiality_notice:string;status:string;investigator_user_id:string|null;
  reviewer_user_id:string|null;outcome_summary:string|null;reporter_safe_outcome:string|null;created_at:string;updated_at:string;closed_at:string|null;
};
type NoteRow={id:number;case_id:string;author_user_id:string;visibility:"REPORTER"|"INVESTIGATOR";note_text:string;evidence_reference:string|null;created_at:string};

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeEthicsError(error.status,error.message);
    throw error;
  }
}
async function can(current:Actor,code:string,own=false){
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  const resource=own?{type:"OWN" as const,key:current.identity.userId,ownerUserId:current.identity.userId}:{type:"COMPANY" as const};
  return (await resolveOfficePermission(current.admin,current.identity,code,resource,device)).allowed;
}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeEthicsError(503,error.message||message)}
function uniq(rows:CaseRow[]){
  const map=new Map<string,CaseRow>();
  for(const row of rows)map.set(row.id,row);
  return [...map.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at));
}

export async function getEthicsWorkspace(){
  const current=await actor();
  const capabilities={
    report:await can(current,"ethics.report",true),
    assign:await can(current,"ethics.case.assign"),
    manage:await can(current,"ethics.case.manage"),
    review:await can(current,"ethics.case.review"),
  };
  if(!capabilities.report&&!capabilities.assign&&!capabilities.manage&&!capabilities.review){
    throw new OfficeEthicsError(403,"Ethics channel is not assigned to your current authority");
  }

  const columns="id,case_code,reporter_user_id,category,severity,title,report_text,reporter_evidence_reference,confidentiality_notice,status,investigator_user_id,reviewer_user_id,outcome_summary,reporter_safe_outcome,created_at,updated_at,closed_at";
  const [own,lead,investigator,review]=await Promise.all([
    capabilities.report
      ? current.admin.from("office_ethics_cases").select(columns).eq("reporter_user_id",current.identity.userId).order("created_at",{ascending:false}).limit(200)
      : Promise.resolve({data:[],error:null}),
    capabilities.assign
      ? current.admin.from("office_ethics_cases").select(columns).not("status","in",'("CLOSED","UNSUBSTANTIATED","WITHDRAWN")').order("created_at",{ascending:false}).limit(500)
      : Promise.resolve({data:[],error:null}),
    capabilities.manage
      ? current.admin.from("office_ethics_cases").select(columns).eq("investigator_user_id",current.identity.userId).order("created_at",{ascending:false}).limit(500)
      : Promise.resolve({data:[],error:null}),
    capabilities.review
      ? current.admin.from("office_ethics_cases").select(columns).eq("status","AWAITING_REVIEW").neq("reporter_user_id",current.identity.userId).order("created_at",{ascending:false}).limit(500)
      : Promise.resolve({data:[],error:null}),
  ]);
  for(const result of [own,lead,investigator,review])fail(result.error,"Ethics cases are temporarily unavailable");

  const cases=uniq([
    ...((own.data||[]) as CaseRow[]),
    ...((lead.data||[]) as CaseRow[]),
    ...((investigator.data||[]) as CaseRow[]),
    ...((review.data||[]) as CaseRow[]),
  ]);
  const ids=cases.map(row=>row.id);
  const notes=ids.length
    ? await current.admin.from("office_ethics_case_notes")
        .select("id,case_id,author_user_id,visibility,note_text,evidence_reference,created_at")
        .in("case_id",ids).order("created_at",{ascending:true}).limit(3000)
    : {data:[],error:null};
  fail(notes.error,"Ethics case correspondence is temporarily unavailable");

  const assignments=capabilities.assign
    ? await current.admin.from("office_user_access_profiles")
        .select("user_id").eq("profile_code","ETHICS_INVESTIGATOR").eq("status","ACTIVE")
    : {data:[],error:null};
  fail(assignments.error,"Ethics investigator directory is temporarily unavailable");
  const investigatorIds=[...new Set((assignments.data||[]).map(row=>String(row.user_id)))];
  const people=investigatorIds.length
    ? await current.admin.from("office_identity_users")
        .select("user_id,display_name,job_title,primary_department,status")
        .in("user_id",investigatorIds).eq("status","ACTIVE").order("display_name")
    : {data:[],error:null};
  fail(people.error,"Ethics investigator directory is temporarily unavailable");

  const allNotes=(notes.data||[]) as NoteRow[];
  const shaped=cases.map(row=>{
    const reporter=row.reporter_user_id===current.identity.userId;
    const assignedInvestigator=capabilities.manage&&row.investigator_user_id===current.identity.userId;
    const independentReviewer=capabilities.review&&row.status==="AWAITING_REVIEW"&&row.reporter_user_id!==current.identity.userId&&row.investigator_user_id!==current.identity.userId;
    const lead=capabilities.assign&&!reporter&&!assignedInvestigator&&!independentReviewer;
    const access_mode=reporter?"REPORTER":assignedInvestigator?"INVESTIGATOR":independentReviewer?"REVIEWER":lead?"LEAD":"RESTRICTED";
    const visible_notes=allNotes.filter(note=>note.case_id===row.id).filter(note=>{
      if(reporter)return note.visibility==="REPORTER";
      if(assignedInvestigator||independentReviewer)return true;
      return false;
    });
    return {
      ...row,
      access_mode,
      outcome_summary:reporter?null:row.outcome_summary,
      visible_notes,
    };
  });

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles},
    capabilities,
    cases:shaped,
    investigators:people.data||[],
    disclaimer:"This channel is confidential but not technically anonymous. Reporter identity is retained. Ordinary owner, executive, HR, admin and manager roles do not receive ethics-case access unless a separate owner-managed Ethics Lead, Investigator or Reviewer profile grants it.",
  };
}

export async function reportEthicsCase(input:{category:string;severity:string;title:string;report:string;evidence?:string}){
  const current=await actor();
  if(!await can(current,"ethics.report",true))throw new OfficeEthicsError(403,"Ethics reporting permission is required");
  const {data,error}=await current.admin.rpc("office_ethics_report",{p_actor:current.identity.userId,p_category:input.category,p_severity:input.severity,p_title:input.title,p_report:input.report,p_evidence:input.evidence?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeEthicsError(400,error?.message||"Unable to submit ethics report");
  return {case_id:data};
}
export async function assignEthicsInvestigator(input:{caseId:string;investigatorUserId:string}){
  const current=await actor();
  if(!await can(current,"ethics.case.assign"))throw new OfficeEthicsError(403,"Ethics case assignment permission is required");
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
