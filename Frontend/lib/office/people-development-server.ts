import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficePeopleDevelopmentError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficePeopleDevelopmentError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type Authority=Actor&{decision:OfficePermissionDecision;department:string|null};

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficePeopleDevelopmentError(error.status,error.message);
    throw error;
  }
}
async function authority(code:string):Promise<Authority>{
  const current=await actor();
  const deviceId=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  const scopes:OfficeResourceScope[]=[
    {type:"COMPANY"},
    ...(current.identity.department?[{type:"DEPARTMENT" as const,key:current.identity.department}]:[]),
    {type:"OWN",key:current.identity.userId},
  ];
  let last:OfficePermissionDecision|undefined;
  for(const scope of scopes){
    const decision=await resolveOfficePermission(current.admin,current.identity,code,scope,deviceId);
    if(decision.allowed)return {...current,decision,department:decision.scopeType==="DEPARTMENT"?(decision.scopeKey||current.identity.department||null):null};
    last=decision;
  }
  throw new OfficePeopleDevelopmentError(403,last?.reason||"People-development permission is required");
}
async function can(code:string){try{await authority(code);return true}catch(error){if(error instanceof OfficePeopleDevelopmentError&&error.status===403)return false;throw error}}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficePeopleDevelopmentError(503,error.message||message)}

async function userIdsInDepartment(current:Authority,department:string){
  const result=await current.admin.from("office_identity_users").select("user_id").eq("primary_department",department).eq("status","ACTIVE").limit(2000);
  fail(result.error,"Department identities are temporarily unavailable");
  return (result.data||[]).map(row=>String(row.user_id));
}
function scopedQuery<T extends {eq:(column:string,value:string)=>T;in:(column:string,values:string[])=>T}>(
  query:T,current:Authority,userIds:string[]
){
  if(current.decision.scopeType==="COMPANY"||current.decision.source==="OWNER")return query;
  if(current.decision.scopeType==="DEPARTMENT")return userIds.length?query.in("user_id",userIds):query.in("user_id",["00000000-0000-0000-0000-000000000000"]);
  return query.eq("user_id",current.identity.userId);
}

export async function getPeopleDevelopmentOverview(){
  const capabilities={
    skills_read:await can("people.skills.read"),skills_declare:await can("people.skills.declare"),skills_verify:await can("people.skills.verify"),
    training_read:await can("people.training.read"),training_manage:await can("people.training.manage"),training_assign:await can("people.training.assign"),
    performance_read:await can("people.performance.read"),performance_manage:await can("people.performance.manage"),performance_review:await can("people.performance.review"),
    plan_read:await can("people.workforce_plan.read"),plan_manage:await can("people.workforce_plan.manage"),plan_review:await can("people.workforce_plan.review"),
  };
  if(!capabilities.skills_read&&!capabilities.training_read&&!capabilities.performance_read&&!capabilities.plan_read)throw new OfficePeopleDevelopmentError(403,"People Development is not assigned to your current authority");

  const base=capabilities.performance_read?await authority("people.performance.read"):capabilities.training_read?await authority("people.training.read"):capabilities.skills_read?await authority("people.skills.read"):await authority("people.workforce_plan.read");
  const deptIds=base.department?await userIdsInDepartment(base,base.department):[];

  let skills=base.admin.from("office_person_skills").select("id,user_id,skill_name,level,verification_status,evidence_reference,declared_by,verified_by,verified_at,last_validated_on,active,created_at,updated_at").eq("active",true).order("skill_name").limit(1500);
  let assignments=base.admin.from("office_training_assignments").select("id,training_id,user_id,assigned_by,due_on,status,completion_evidence_reference,completed_at,expires_on,note,created_at,updated_at").order("created_at",{ascending:false}).limit(1500);
  let reviews=base.admin.from("office_performance_reviews").select("id,review_code,user_id,reviewer_user_id,department_code,period_start,period_end,goals,employee_summary,reviewer_summary,outcome,development_plan,status,created_by,finalized_by,finalized_at,created_at,updated_at").order("period_end",{ascending:false}).limit(1000);

  if(capabilities.skills_read)skills=scopedQuery(skills,base,deptIds);
  if(capabilities.training_read)assignments=scopedQuery(assignments,base,deptIds);
  if(capabilities.performance_read)reviews=scopedQuery(reviews,base,deptIds);

  let plans=base.admin.from("office_workforce_plans").select("id,plan_code,department_code,period_start,period_end,current_headcount,target_headcount,approved_headcount,rationale,budget_reference,status,created_by,reviewed_by,reviewed_at,review_note,created_at,updated_at").order("period_end",{ascending:false}).limit(500);
  if(base.department)plans=plans.eq("department_code",base.department);

  const peopleQuery=base.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name").limit(2000);
  const [skillsResult,catalogResult,assignmentResult,reviewResult,planResult,peopleResult]=await Promise.all([
    capabilities.skills_read?skills:Promise.resolve({data:[],error:null}),
    capabilities.training_read?base.admin.from("office_training_catalog").select("id,training_code,title,category,description,validity_months,evidence_required,active,created_by,created_at,updated_at").eq("active",true).order("title"):Promise.resolve({data:[],error:null}),
    capabilities.training_read?assignments:Promise.resolve({data:[],error:null}),
    capabilities.performance_read?reviews:Promise.resolve({data:[],error:null}),
    capabilities.plan_read?plans:Promise.resolve({data:[],error:null}),
    peopleQuery,
  ]);
  for(const result of [skillsResult,catalogResult,assignmentResult,reviewResult,planResult,peopleResult])fail(result.error,"People Development records are temporarily unavailable");

  const allowedPeople=base.decision.scopeType==="OWN"
    ? (peopleResult.data||[]).filter(row=>row.user_id===base.identity.userId)
    : base.department
      ? (peopleResult.data||[]).filter(row=>row.primary_department===base.department)
      : peopleResult.data||[];

  return {
    actor:{user_id:base.identity.userId,roles:base.identity.roles,department:base.identity.department||null},
    scope:{type:base.decision.scopeType||null,key:base.department},
    capabilities,
    people:allowedPeople,
    skills:skillsResult.data||[],
    training_catalog:catalogResult.data||[],
    training_assignments:assignmentResult.data||[],
    performance_reviews:reviewResult.data||[],
    workforce_plans:planResult.data||[],
    disclaimer:"Performance outcomes are explicit human review decisions. KRAVIA does not calculate employee performance from login duration, presence, commits or passive activity telemetry.",
  };
}

export async function declareOwnSkill(input:{skill:string;level:string;evidence?:string}){
  const current=await authority("people.skills.declare");
  const {data,error}=await current.admin.rpc("office_skill_declare",{p_actor:current.identity.userId,p_skill:input.skill,p_level:input.level,p_evidence:input.evidence?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePeopleDevelopmentError(400,error?.message||"Unable to declare skill");
  return {skill_id:data};
}
export async function verifySkill(input:{skillId:string;status:string;evidence?:string}){
  const current=await authority("people.skills.verify");
  const {data,error}=await current.admin.rpc("office_skill_verify",{p_actor:current.identity.userId,p_skill:input.skillId,p_status:input.status,p_evidence:input.evidence?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePeopleDevelopmentError(400,error?.message||"Unable to verify skill");
  return {status:data};
}
export async function createTraining(input:{title:string;category:string;description:string;validityMonths?:number;evidenceRequired:boolean}){
  const current=await authority("people.training.manage");
  const {data,error}=await current.admin.rpc("office_training_create",{p_actor:current.identity.userId,p_title:input.title,p_category:input.category,p_description:input.description,p_validity:input.validityMonths??null,p_evidence:input.evidenceRequired});
  if(error||typeof data!=="string")throw new OfficePeopleDevelopmentError(400,error?.message||"Unable to create training");
  return {training_id:data};
}
export async function assignTraining(input:{trainingId:string;userId:string;dueOn?:string;note?:string}){
  const current=await authority("people.training.assign");
  const {data,error}=await current.admin.rpc("office_training_assign",{p_actor:current.identity.userId,p_training:input.trainingId,p_user:input.userId,p_due:input.dueOn??null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePeopleDevelopmentError(400,error?.message||"Unable to assign training");
  return {assignment_id:data};
}
export async function transitionTraining(input:{assignmentId:string;status:string;evidence?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_training_transition",{p_actor:current.identity.userId,p_assignment:input.assignmentId,p_status:input.status,p_evidence:input.evidence?.trim()||null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePeopleDevelopmentError(400,error?.message||"Unable to update training");
  return {status:data};
}
export async function createPerformanceReview(input:{userId:string;reviewerUserId:string;periodStart:string;periodEnd:string;goals:unknown[]}){
  const current=await authority("people.performance.manage");
  const {data,error}=await current.admin.rpc("office_performance_create",{p_actor:current.identity.userId,p_user:input.userId,p_reviewer:input.reviewerUserId,p_start:input.periodStart,p_end:input.periodEnd,p_goals:input.goals});
  if(error||typeof data!=="string")throw new OfficePeopleDevelopmentError(400,error?.message||"Unable to create performance review");
  return {review_id:data};
}
export async function transitionPerformanceReview(input:{reviewId:string;status:string;employeeSummary?:string;reviewerSummary?:string;outcome?:string;developmentPlan?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_performance_transition",{p_actor:current.identity.userId,p_review:input.reviewId,p_status:input.status,p_employee_summary:input.employeeSummary?.trim()||null,p_reviewer_summary:input.reviewerSummary?.trim()||null,p_outcome:input.outcome||null,p_development:input.developmentPlan?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePeopleDevelopmentError(400,error?.message||"Unable to update performance review");
  return {status:data};
}
export async function createWorkforcePlan(input:{department:string;periodStart:string;periodEnd:string;currentHeadcount:number;targetHeadcount:number;rationale:string;budgetReference?:string}){
  const current=await authority("people.workforce_plan.manage");
  const {data,error}=await current.admin.rpc("office_workforce_plan_create",{p_actor:current.identity.userId,p_department:input.department,p_start:input.periodStart,p_end:input.periodEnd,p_current:input.currentHeadcount,p_target:input.targetHeadcount,p_rationale:input.rationale,p_budget:input.budgetReference?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePeopleDevelopmentError(400,error?.message||"Unable to create workforce plan");
  return {plan_id:data};
}
export async function transitionWorkforcePlan(input:{planId:string;status:string;approvedHeadcount?:number;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_workforce_plan_transition",{p_actor:current.identity.userId,p_plan:input.planId,p_status:input.status,p_approved:input.approvedHeadcount??null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePeopleDevelopmentError(400,error?.message||"Unable to update workforce plan");
  return {status:data};
}
