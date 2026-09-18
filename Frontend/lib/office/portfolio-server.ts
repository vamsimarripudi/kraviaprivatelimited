import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";
import { readOfficeRuntimeResult } from "@/lib/office/runtime-read-server";

export class OfficePortfolioError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficePortfolioError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type Authority=Actor&{decision:OfficePermissionDecision;department:string|null};

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficePortfolioError(error.status,error.message);
    throw error;
  }
}
async function authority(code:string):Promise<Authority>{
  const current=await actor();
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  const scopes:OfficeResourceScope[]=[
    {type:"COMPANY"},
    ...(current.identity.department?[{type:"DEPARTMENT" as const,key:current.identity.department}]:[]),
  ];
  let last:OfficePermissionDecision|undefined;
  for(const scope of scopes){
    const decision=await resolveOfficePermission(current.admin,current.identity,code,scope,device);
    if(decision.allowed)return {...current,decision,department:decision.scopeType==="DEPARTMENT"?(decision.scopeKey||current.identity.department||null):null};
    last=decision;
  }
  throw new OfficePortfolioError(403,last?.reason||"Portfolio permission is required");
}
async function can(code:string){try{await authority(code);return true}catch(error){if(error instanceof OfficePortfolioError&&error.status===403)return false;throw error}}
async function ownMemberRead(){
  const current=await actor();
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  const decision=await resolveOfficePermission(current.admin,current.identity,"portfolio.member.read",{type:"OWN",key:current.identity.userId,ownerUserId:current.identity.userId},device);
  return decision.allowed?{...current,decision,department:null}:null;
}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficePortfolioError(503,error.message||message)}

export async function getPortfolioOverview(){
  const [read,memberRead,manage,review,milestoneManage,teamManage]=await Promise.all([
    can("portfolio.read"),
    ownMemberRead(),
    can("portfolio.manage"),
    can("portfolio.review"),
    can("portfolio.milestone.manage"),
    can("portfolio.team.manage"),
  ]);
  const capabilities={
    read,
    member_read:Boolean(memberRead),
    manage,
    review,
    milestone_manage:milestoneManage,
    team_manage:teamManage,
  };
  if(!read&&!memberRead)throw new OfficePortfolioError(403,"Portfolio is not assigned to your current authority");

  const current=read?await authority("portfolio.read"):memberRead!;
  let projectIds:string[]|null=null;

  if(!read){
    const [ownedProjects,ownedWorkstreams,ownedMilestones,memberships]=await Promise.all([
      current.admin.from("office_portfolio_projects").select("id").eq("owner_user_id",current.identity.userId).limit(1000),
      current.admin.from("office_portfolio_workstreams").select("project_id").eq("owner_user_id",current.identity.userId).neq("status","CANCELLED").limit(2000),
      current.admin.from("office_portfolio_milestones").select("project_id").eq("owner_user_id",current.identity.userId).not("status","in",'("DONE","CANCELLED")').limit(3000),
      current.admin.from("office_portfolio_members").select("project_id").eq("user_id",current.identity.userId).eq("active",true).limit(3000),
    ]);
    for(const result of [ownedProjects,ownedWorkstreams,ownedMilestones,memberships])fail(result.error,"Assigned project scope is temporarily unavailable");
    projectIds=[...new Set([
      ...(ownedProjects.data||[]).map(row=>String(row.id)),
      ...(ownedWorkstreams.data||[]).map(row=>String(row.project_id)),
      ...(ownedMilestones.data||[]).map(row=>String(row.project_id)),
      ...(memberships.data||[]).map(row=>String(row.project_id)),
    ])];
  }

  let projectQuery=current.admin.from("office_portfolio_projects")
    .select("id,project_code,program_name,title,description,department_code,product_id,owner_user_id,sponsor_user_id,priority,starts_on,target_end_on,budget_reference,reported_health,health_note,status,completion_evidence_reference,created_by,reviewed_by,reviewed_at,review_note,created_at,updated_at")
    .order("updated_at",{ascending:false}).limit(1000);
  if(read&&current.department)projectQuery=projectQuery.eq("department_code",current.department);
  if(!read)projectQuery=projectIds?.length?projectQuery.in("id",projectIds):projectQuery.in("id",["00000000-0000-0000-0000-000000000000"]);
  const projects=await projectQuery;
  fail(projects.error,"Portfolio projects are temporarily unavailable");
  const ids=(projects.data||[]).map(row=>String(row.id));

  const [workstreams,milestones,dependencies,members,events,products]=await Promise.all([
    ids.length?current.admin.from("office_portfolio_workstreams")
      .select("id,workstream_code,project_id,title,description,owner_user_id,starts_on,target_end_on,status,created_by,created_at,updated_at")
      .in("project_id",ids).order("target_end_on",{ascending:true,nullsFirst:false}).limit(2500):Promise.resolve({data:[],error:null}),
    ids.length?current.admin.from("office_portfolio_milestones")
      .select("id,milestone_code,project_id,workstream_id,title,description,owner_user_id,due_on,status,blocked_reason,deliverable_reference,completion_evidence_reference,created_by,completed_at,created_at,updated_at")
      .in("project_id",ids).order("due_on",{ascending:true,nullsFirst:false}).limit(5000):Promise.resolve({data:[],error:null}),
    ids.length?current.admin.from("office_portfolio_dependencies")
      .select("id,project_id,predecessor_milestone_id,successor_milestone_id,note,active,created_by,created_at,updated_at")
      .in("project_id",ids).eq("active",true).limit(5000):Promise.resolve({data:[],error:null}),
    ids.length?current.admin.from("office_portfolio_members")
      .select("id,project_id,user_id,project_role,workstream_id,active,assigned_by,created_at,updated_at")
      .in("project_id",ids).eq("active",true).limit(5000):Promise.resolve({data:[],error:null}),
    ids.length?current.admin.from("office_portfolio_events")
      .select("id,actor_user_id,project_id,workstream_id,milestone_id,event_type,previous_status,new_status,note,metadata,created_at")
      .in("project_id",ids).order("created_at",{ascending:false}).limit(5000):Promise.resolve({data:[],error:null}),
    readOfficeRuntimeResult<Array<Record<string,unknown>>>("products").then((result)=>({
      ...result,
      data:(result.data??[]).slice(0,500).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""))),
    })),
  ]);
  for(const result of [workstreams,milestones,dependencies,members,events,products])fail(result.error,"Portfolio supporting records are temporarily unavailable");

  let peopleResult:{data:Array<Record<string,unknown>>|null;error:{message?:string}|null};
  if(manage||milestoneManage||teamManage){
    peopleResult=current.department
      ? await current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").eq("primary_department",current.department).order("display_name")
      : await current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name").limit(3000);
  }else{
    const personIds=[...new Set([
      current.identity.userId,
      ...(projects.data||[]).flatMap(row=>[String(row.owner_user_id),row.sponsor_user_id?String(row.sponsor_user_id):""]).filter(Boolean),
      ...(workstreams.data||[]).map(row=>String(row.owner_user_id)),
      ...(milestones.data||[]).map(row=>String(row.owner_user_id)),
      ...(members.data||[]).map(row=>String(row.user_id)),
    ])];
    peopleResult=personIds.length
      ? await current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").in("user_id",personIds).eq("status","ACTIVE").order("display_name")
      : {data:[],error:null};
  }
  fail(peopleResult.error,"Portfolio identities are temporarily unavailable");

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles,department:current.identity.department||null},
    scope:{type:current.decision.scopeType||null,key:read?current.department:current.identity.userId},
    capabilities,
    projects:projects.data||[],
    workstreams:workstreams.data||[],
    milestones:milestones.data||[],
    dependencies:dependencies.data||[],
    members:members.data||[],
    events:events.data||[],
    people:peopleResult.data||[],
    products:products.data||[],
    disclaimer:"Project membership is operating metadata, not an authorization grant. Participant read reveals only assigned project context. Project health is explicitly reported by accountable humans; KRAVIA does not derive employee or project performance scores from login time, commits, passive activity or task counts.",
  };
}

export async function createPortfolioProject(input:{program?:string;title:string;description:string;department:string;productId?:string;ownerUserId:string;sponsorUserId?:string;priority:string;startsOn?:string;targetEndOn?:string;budgetReference?:string}){
  const current=await authority("portfolio.manage");
  const {data,error}=await current.admin.rpc("office_portfolio_project_create",{p_actor:current.identity.userId,p_program:input.program?.trim()||null,p_title:input.title,p_description:input.description,p_department:input.department,p_product:input.productId??null,p_owner:input.ownerUserId,p_sponsor:input.sponsorUserId??null,p_priority:input.priority,p_start:input.startsOn??null,p_target:input.targetEndOn??null,p_budget:input.budgetReference?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePortfolioError(400,error?.message||"Unable to create project");
  return {project_id:data};
}
export async function transitionPortfolioProject(input:{projectId:string;status:string;evidence?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_portfolio_project_transition",{p_actor:current.identity.userId,p_project:input.projectId,p_status:input.status,p_evidence:input.evidence?.trim()||null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePortfolioError(400,error?.message||"Unable to transition project");
  return {status:data};
}
export async function updatePortfolioHealth(input:{projectId:string;health:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_portfolio_project_health",{p_actor:current.identity.userId,p_project:input.projectId,p_health:input.health,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePortfolioError(400,error?.message||"Unable to update project health");
  return {health:data};
}
export async function createPortfolioWorkstream(input:{projectId:string;title:string;description?:string;ownerUserId:string;startsOn?:string;targetEndOn?:string}){
  const current=await authority("portfolio.milestone.manage");
  const {data,error}=await current.admin.rpc("office_portfolio_workstream_create",{p_actor:current.identity.userId,p_project:input.projectId,p_title:input.title,p_description:input.description?.trim()||null,p_owner:input.ownerUserId,p_start:input.startsOn??null,p_target:input.targetEndOn??null});
  if(error||typeof data!=="string")throw new OfficePortfolioError(400,error?.message||"Unable to create workstream");
  return {workstream_id:data};
}
export async function transitionPortfolioWorkstream(input:{workstreamId:string;status:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_portfolio_workstream_transition",{p_actor:current.identity.userId,p_workstream:input.workstreamId,p_status:input.status,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePortfolioError(400,error?.message||"Unable to transition workstream");
  return {status:data};
}
export async function createPortfolioMilestone(input:{projectId:string;workstreamId?:string;title:string;description?:string;ownerUserId:string;dueOn?:string;deliverableReference?:string}){
  const current=await authority("portfolio.milestone.manage");
  const {data,error}=await current.admin.rpc("office_portfolio_milestone_create",{p_actor:current.identity.userId,p_project:input.projectId,p_workstream:input.workstreamId??null,p_title:input.title,p_description:input.description?.trim()||null,p_owner:input.ownerUserId,p_due:input.dueOn??null,p_deliverable:input.deliverableReference?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePortfolioError(400,error?.message||"Unable to create milestone");
  return {milestone_id:data};
}
export async function createPortfolioDependency(input:{projectId:string;predecessorId:string;successorId:string;note?:string}){
  const current=await authority("portfolio.milestone.manage");
  const {data,error}=await current.admin.rpc("office_portfolio_dependency_create",{p_actor:current.identity.userId,p_project:input.projectId,p_predecessor:input.predecessorId,p_successor:input.successorId,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePortfolioError(400,error?.message||"Unable to create milestone dependency");
  return {dependency_id:data};
}
export async function deactivatePortfolioDependency(input:{dependencyId:string;reason:string}){
  const current=await authority("portfolio.milestone.manage");
  const {data,error}=await current.admin.rpc("office_portfolio_dependency_deactivate",{p_actor:current.identity.userId,p_dependency:input.dependencyId,p_reason:input.reason});
  if(error||data!==true)throw new OfficePortfolioError(400,error?.message||"Unable to deactivate milestone dependency");
  return {deactivated:true};
}
export async function transitionPortfolioMilestone(input:{milestoneId:string;status:string;blockedReason?:string;evidence?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_portfolio_milestone_transition",{p_actor:current.identity.userId,p_milestone:input.milestoneId,p_status:input.status,p_blocked_reason:input.blockedReason?.trim()||null,p_evidence:input.evidence?.trim()||null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficePortfolioError(400,error?.message||"Unable to transition milestone");
  return {status:data};
}
export async function assignPortfolioMember(input:{projectId:string;userId:string;projectRole:string;workstreamId?:string}){
  const current=await authority("portfolio.team.manage");
  const {data,error}=await current.admin.rpc("office_portfolio_member_assign",{p_actor:current.identity.userId,p_project:input.projectId,p_user:input.userId,p_role:input.projectRole,p_workstream:input.workstreamId??null});
  if(error||typeof data!=="string")throw new OfficePortfolioError(400,error?.message||"Unable to assign project member");
  return {membership_id:data};
}
export async function deactivatePortfolioMember(input:{membershipId:string;reason:string}){
  const current=await authority("portfolio.team.manage");
  const {data,error}=await current.admin.rpc("office_portfolio_member_deactivate",{p_actor:current.identity.userId,p_member:input.membershipId,p_reason:input.reason});
  if(error||data!==true)throw new OfficePortfolioError(400,error?.message||"Unable to deactivate project membership");
  return {deactivated:true};
}
