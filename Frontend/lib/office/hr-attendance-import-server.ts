import "server-only";

import { createHash } from "node:crypto";
import { requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { extractKraviaAttendanceWorkbook, HrWorkbookError,
  type HrExtractIssue, type HrExtractedRow } from "@/lib/office/hr-attendance-workbook";

export class HrImportError extends Error {
  constructor(public readonly status: number,message:string) {
    super(message);this.name="HrImportError";
  }
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
function guard(error:{message?:string}|null,message:string) {
  if(error)throw new HrImportError(503,message);
}
async function hrActor():Promise<Actor>{
  const actor=await requireOfficeActor();
  const permission=await resolveOfficePermission(actor.admin,actor.identity,"people.update",{type:"COMPANY"});
  if(!permission.allowed)throw new HrImportError(403,"Current HR/People update authority is required");
  const board=actor.identity.roles.some(r=>r==="DIRECTOR"||r==="OWNER");
  if(!board){
    const result=await actor.admin.from("office_user_access_profiles")
      .select("effective_from,expires_at").eq("user_id",actor.identity.userId)
      .eq("profile_code","HR_MANAGER").eq("status","ACTIVE");
    guard(result.error,"HR access grants unavailable");
    const now=Date.now();
    const current=(result.data||[]).some(r=>{
      const from=r.effective_from?Date.parse(String(r.effective_from)):0;
      const through=r.expires_at?Date.parse(String(r.expires_at)):Number.POSITIVE_INFINITY;
      return Number.isFinite(from)&&from<=now&&through>now;
    });
    if(!current)throw new HrImportError(403,"Current HR Manager or Director access is required");
  }
  return actor;
}
type RosterRow={user_id:string;display_name:string|null;status:string};
type EmploymentRow={identity_user_id:string;status:string;start_date:string|null};
export type HrValidatedRow=HrExtractedRow & {
  employeeUserId:string|null;eligible:boolean;
};
async function readRoster(actor:Actor){
  const [identities,employments]=await Promise.all([
    actor.admin.from("office_identity_users")
      .select("user_id,display_name,status").eq("status","ACTIVE").limit(600),
    actor.admin.from("office_employment_registry")
      .select("identity_user_id,status,start_date").limit(600),
  ]);
  guard(identities.error,"Employee identity directory could not be verified");
  guard(employments.error,"Employment registry could not be verified");
  const employees=(identities.data||[]) as RosterRow[];
  const records=(employments.data||[]) as EmploymentRow[];
  return {employees,records};
}
const normalize=(name:string)=>name.trim().replace(/\s+/g," ").toLocaleLowerCase("en");
function classify(rows:HrExtractedRow[],roster:Awaited<ReturnType<typeof readRoster>>){
  const issues:HrExtractIssue[]=[];
  const directory=new Map<string,RosterRow[]>();
  for(const person of roster.employees){
    const key=normalize(person.display_name||"");
    if(!key)continue;
    directory.set(key,[...(directory.get(key)||[]),person]);
  }
  const nowIST=new Date(Date.now()+330*60_000).toISOString().slice(0,10);
  const validated:HrValidatedRow[]=rows.map(row=>{
    const found=directory.get(normalize(row.employee))||[];
    let employeeUserId:string|null=found.length===1?found[0].user_id:null;
    let eligible=true;
    const issue=(detail:string,severity:"ERROR"|"WARNING"="ERROR")=>{
      issues.push({sheet:row.sheet,row:row.row,employee:row.employee,severity,detail});
      if(severity==="ERROR")eligible=false;
    };
    if(found.length!==1){issue("Employee name must resolve to exactly one active Office identity");employeeUserId=null;}
    if(row.workDate>nowIST)issue("Future workbook dates cannot be staged or paid");
    if(employeeUserId){
      const emp=roster.records.filter(e=>e.identity_user_id===employeeUserId);
      if(!emp.some(e=>["ACTIVE","ON_LEAVE"].includes(e.status)))
        issue("Employee employment is not ACTIVE or ON_LEAVE; verify onboarding before staging");
      if(emp.some(e=>["ACTIVE","ON_LEAVE"].includes(e.status)&&!e.start_date))
        issue("Employment start date is missing; independent HR review must verify the signed appointment","WARNING");
      const valid=emp.find(e=>["ACTIVE","ON_LEAVE"].includes(e.status)&&!!e.start_date);
      if(valid?.start_date&&row.workDate<valid.start_date)
        issue("Workbook date predates the recorded employment start; reconcile original sources");
    }
    return {...row,employeeUserId,eligible};
  });
  return {rows:validated,issues};
}
const MAX_BYTES=2_097_152;
function filename(file:File){
  if(file.size===0||file.size>MAX_BYTES)throw new HrImportError(413,"Workbook must be 1 byte–2 MiB");
  const name=file.name.trim();
  if(!/^[^\\/\x00-\x1f]{1,175}\.xlsx$/i.test(name))
    throw new HrImportError(400,"Only an .xlsx KRAVIA HR reconciliation file is accepted");
  if(file.type&&!["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream","application/zip"].includes(file.type))
    throw new HrImportError(400,"Uploaded MIME type is not an Excel workbook");
  return name;
}
export async function analyzeHrAttendanceFile(file:File){
  const actor=await hrActor();
  const safeName=filename(file);
  const bytes=Buffer.from(await file.arrayBuffer());
  if(bytes.length!==file.size)throw new HrImportError(400,"Upload was truncated");
  const sha256=createHash("sha256").update(bytes).digest("hex");
  let parsed:ReturnType<typeof extractKraviaAttendanceWorkbook>;
  try{parsed=extractKraviaAttendanceWorkbook(bytes);}
  catch(error){throw new HrImportError(400,error instanceof HrWorkbookError?error.message:"Workbook cannot be read safely");}
  const roster=await readRoster(actor);
  const validated=classify(parsed.candidates,roster);
  const issues=[...parsed.issues,...validated.issues];
  const existing=await actor.admin.from("office_hr_attendance_import_batches")
    .select("id").eq("file_sha256",sha256).maybeSingle();
  guard(existing.error,"HR import duplicate audit is unavailable");
  if(existing.data)issues.push({sheet:"Workbook",row:0,employee:"",
    severity:"ERROR",detail:"This exact workbook was already staged; open the existing batch instead of duplicating entries"});
  const ready=parsed.candidates.length>0&&!issues.some(item=>item.severity==="ERROR");
  return {
    actor,filename:safeName,sha256,
    extraction:{...parsed,candidates:validated.rows,issues},
    eligibleRows:validated.rows.filter(row=>row.eligible&&row.employeeUserId),
    readyToStage:ready,
    existingBatchId:existing.data?.id||null,
  };
}
export async function previewHrAttendanceFile(file:File){
  const parsed=await analyzeHrAttendanceFile(file);
  return {fileName:parsed.filename,fileSha256:parsed.sha256,
    sourceSessions:parsed.extraction.sourceSessions,
    sheetsRead:parsed.extraction.sheetsRead,
    ignoredUneditedDays:parsed.extraction.ignoredUneditedDays,
    candidates:parsed.extraction.candidates,
    issues:parsed.extraction.issues,
    readyToStage:parsed.readyToStage,existingBatchId:parsed.existingBatchId,
    notice:"Workbook decisions and minutes are candidates ONLY. Staging never changes attendance timestamps, paid leave, overtime, salary, approvals or bank settlement."};
}
export async function stageHrAttendanceFile(file:File){
  const parsed=await analyzeHrAttendanceFile(file);
  if(!parsed.readyToStage)
    throw new HrImportError(409,"Resolve all workbook errors before staging. Preview shows each source row requiring correction");
  const payload=parsed.eligibleRows.map(row=>({
    key:row.key,sheet:row.sheet,row:row.row,employee_user_id:row.employeeUserId,
    work_date:row.workDate,payable_minutes:row.payableMinutes,
    paid_leave_minutes:row.paidLeaveMinutes,
    overtime_candidate_minutes:row.overtimeCandidateMinutes,
    evidence_reference:row.evidenceReference,workbook_decision:row.workbookDecision,
    source_status:row.sourceStatus,
  }));
  const {data,error}=await parsed.actor.admin.rpc("office_hr_attendance_import_stage",{
    p_actor:parsed.actor.identity.userId,
    p_file_name:parsed.filename,p_file_sha256:parsed.sha256,p_rows:payload,
  });
  if(error||typeof data!=="string")throw new HrImportError(409,error?.message||"HR import staging failed; no payroll records were changed");
  return {batchId:data,rowsStaged:payload.length,fileSha256:parsed.sha256,status:"STAGED",
    notice:"Source records staged for independent HR evidence review. No salary, leave or overtime was approved."};
}
export async function readHrAttendanceImports(batchId?:string){
  const actor=await hrActor();
  const batches=await actor.admin.from("office_hr_attendance_import_batches")
    .select("id,file_name,file_sha256,created_by,row_count,status,created_at")
    .order("created_at",{ascending:false}).limit(30);
  guard(batches.error,"Cannot load private HR import history");
  const current=batchId||batches.data?.[0]?.id;
  const peopleResult=await actor.admin.from("office_identity_users")
    .select("user_id,display_name").eq("status","ACTIVE").limit(600);
  guard(peopleResult.error,"HR employee names unavailable");
  const people=peopleResult.data||[];
  if(!current)return {batches:batches.data||[],rows:[],people,actorId:actor.identity.userId};
  const allowed=(batches.data||[]).some(b=>b.id===current);
  if(!allowed)throw new HrImportError(404,"HR import batch not found");
  const rows=await actor.admin.from("office_hr_attendance_import_rows")
    .select("id,batch_id,row_key,source_sheet,source_row,employee_user_id,work_date,payable_candidate_minutes,paid_leave_candidate_minutes,overtime_candidate_minutes,evidence_reference,workbook_decision,status,reviewed_by,reviewed_at,review_note")
    .eq("batch_id",current).order("source_sheet").order("source_row").limit(400);
  guard(rows.error,"Cannot load reviewed HR import entries");
  return {batches:batches.data||[],rows:rows.data||[],people,actorId:actor.identity.userId};
}
export async function reviewHrAttendanceRow(input:{rowId:string;decision:"ACCEPT"|"REJECT";note:string}){
  const actor=await hrActor();
  const {data,error}=await actor.admin.rpc("office_hr_attendance_import_review",{
    p_actor:actor.identity.userId,p_row:input.rowId,p_decision:input.decision,p_note:input.note.trim(),
  });
  if(error||typeof data!=="string")throw new HrImportError(409,error?.message||"Independent HR review failed");
  return {status:data,appliedToPayroll:false,notice:"Source evidence reviewed only. Employee salary and time remain governed by separate payroll approvals."};
}
