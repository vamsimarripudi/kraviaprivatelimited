import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeStrategyError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeStrategyError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type Authority=Actor&{decision:OfficePermissionDecision;department:string|null};

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeStrategyError(error.status,error.message);
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
  throw new OfficeStrategyError(403,last?.reason||"Strategy permission is required");
}
async function can(code:string){try{await authority(code);return true}catch(error){if(error instanceof OfficeStrategyError&&error.status===403)return false;throw error}}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeStrategyError(503,error.message||message)}

export async function getStrategyOverview(){
  const capabilities={
    read:await can("strategy.read"),
    manage:await can("strategy.manage"),
    review:await can("strategy.review"),
    progress_update:await can("strategy.progress.update"),
  };
  if(!capabilities.read)throw new OfficeStrategyError(403,"Strategy workspace is not assigned to your current authority");
  const current=await authority("strategy.read");

  let cycleQuery=current.admin.from("office_strategy_cycles")
    .select("id,cycle_code,title,scope_type,scope_key,period_start,period_end,owner_user_id,status,created_by,reviewed_by,reviewed_at,review_note,closure_evidence_reference,created_at,updated_at")
    .order("period_start",{ascending:false}).limit(1000);
  if(current.decision.scopeType==="DEPARTMENT"&&current.department){
    cycleQuery=cycleQuery.or("scope_type.eq.COMPANY,and(scope_type.eq.DEPARTMENT,scope_key.eq."+current.department+")");
  }
  const cycles=await cycleQuery;
  fail(cycles.error,"Strategy cycles are temporarily unavailable");
  const cycleIds=(cycles.data||[]).map(row=>String(row.id));

  const objectives=cycleIds.length
    ? await current.admin.from("office_strategy_objectives")
        .select("id,objective_code,cycle_id,parent_objective_id,title,description,owner_user_id,priority,status,completion_evidence_reference,created_by,created_at,updated_at")
        .in("cycle_id",cycleIds).order("created_at",{ascending:true}).limit(3000)
    : {data:[],error:null};
  fail(objectives.error,"Strategy objectives are temporarily unavailable");
  const objectiveIds=(objectives.data||[]).map(row=>String(row.id));

  const keyResults=objectiveIds.length
    ? await current.admin.from("office_strategy_key_results")
        .select("id,key_result_code,objective_id,title,owner_user_id,measurement_kind,unit,start_value,target_value,current_value,currency,reported_status,progress_note,evidence_reference,due_on,last_reported_by,last_reported_at,created_by,created_at,updated_at")
        .in("objective_id",objectiveIds).order("due_on",{ascending:true,nullsFirst:false}).limit(6000)
    : {data:[],error:null};
  fail(keyResults.error,"Strategy key results are temporarily unavailable");

  const people=(capabilities.manage||capabilities.review||capabilities.progress_update)
    ? await (current.department
        ? current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").eq("primary_department",current.department).order("display_name")
        : current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name").limit(3000))
    : {data:[],error:null};
  fail(people.error,"Office identities are temporarily unavailable");

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles,department:current.identity.department||null},
    scope:{type:current.decision.scopeType||null,key:current.department},
    capabilities,
    cycles:cycles.data||[],
    objectives:objectives.data||[],
    key_results:keyResults.data||[],
    people:people.data||[],
    disclaimer:"Strategy health and key-result progress are explicitly reported by accountable humans. KRAVIA does not derive OKR or employee-performance scores from commits, login time, attendance, task counts or passive activity.",
  };
}

export async function createStrategyCycle(input:{title:string;scopeType:string;scopeKey?:string;periodStart:string;periodEnd:string;ownerUserId:string}){
  const current=await authority("strategy.manage");
  const {data,error}=await current.admin.rpc("office_strategy_cycle_create",{p_actor:current.identity.userId,p_title:input.title,p_scope_type:input.scopeType,p_scope_key:input.scopeKey?.trim()||null,p_start:input.periodStart,p_end:input.periodEnd,p_owner:input.ownerUserId});
  if(error||typeof data!=="string")throw new OfficeStrategyError(400,error?.message||"Unable to create strategy cycle");
  return {cycle_id:data};
}
export async function transitionStrategyCycle(input:{cycleId:string;status:string;evidence?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_strategy_cycle_transition",{p_actor:current.identity.userId,p_cycle:input.cycleId,p_status:input.status,p_evidence:input.evidence?.trim()||null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeStrategyError(400,error?.message||"Unable to transition strategy cycle");
  return {status:data};
}
export async function createStrategyObjective(input:{cycleId:string;parentObjectiveId?:string;title:string;description:string;ownerUserId:string;priority:string}){
  const current=await authority("strategy.manage");
  const {data,error}=await current.admin.rpc("office_strategy_objective_create",{p_actor:current.identity.userId,p_cycle:input.cycleId,p_parent:input.parentObjectiveId??null,p_title:input.title,p_description:input.description,p_owner:input.ownerUserId,p_priority:input.priority});
  if(error||typeof data!=="string")throw new OfficeStrategyError(400,error?.message||"Unable to create objective");
  return {objective_id:data};
}
export async function transitionStrategyObjective(input:{objectiveId:string;status:string;evidence?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_strategy_objective_transition",{p_actor:current.identity.userId,p_objective:input.objectiveId,p_status:input.status,p_evidence:input.evidence?.trim()||null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeStrategyError(400,error?.message||"Unable to transition objective");
  return {status:data};
}
export async function createStrategyKeyResult(input:{objectiveId:string;title:string;ownerUserId:string;kind:string;unit?:string;startValue?:number;targetValue?:number;currency?:string;dueOn?:string}){
  const current=await authority("strategy.manage");
  const {data,error}=await current.admin.rpc("office_strategy_kr_create",{p_actor:current.identity.userId,p_objective:input.objectiveId,p_title:input.title,p_owner:input.ownerUserId,p_kind:input.kind,p_unit:input.unit?.trim()||null,p_start:input.startValue??null,p_target:input.targetValue??null,p_currency:input.currency?.trim()||null,p_due:input.dueOn??null});
  if(error||typeof data!=="string")throw new OfficeStrategyError(400,error?.message||"Unable to create key result");
  return {key_result_id:data};
}
export async function reportStrategyProgress(input:{keyResultId:string;value?:number;status:string;note?:string;evidence?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_strategy_kr_report",{p_actor:current.identity.userId,p_kr:input.keyResultId,p_value:input.value??null,p_status:input.status,p_note:input.note?.trim()||null,p_evidence:input.evidence?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeStrategyError(400,error?.message||"Unable to report key-result progress");
  return {status:data};
}
