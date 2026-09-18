import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeBudgetError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeBudgetError"}
}

type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type Authority=Actor&{decision:OfficePermissionDecision;department:string|null};

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeBudgetError(error.status,error.message);
    throw error;
  }
}

async function authority(code:string):Promise<Authority>{
  const current=await actor();
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  const scopes:OfficeResourceScope[]=[
    {type:"COMPANY"},
    ...(current.identity.department?[{type:"DEPARTMENT" as const,key:current.identity.department}]:[]),
    {type:"OWN",key:current.identity.userId,ownerUserId:current.identity.userId},
  ];
  let last:OfficePermissionDecision|undefined;
  for(const scope of scopes){
    const decision=await resolveOfficePermission(current.admin,current.identity,code,scope,device);
    if(decision.allowed)return {...current,decision,department:decision.scopeType==="DEPARTMENT"?(decision.scopeKey||current.identity.department||null):null};
    last=decision;
  }
  throw new OfficeBudgetError(403,last?.reason||"Budget permission is required");
}

async function can(code:string){
  try{await authority(code);return true}catch(error){
    if(error instanceof OfficeBudgetError&&error.status===403)return false;
    throw error;
  }
}

function fail(error:{message?:string}|null,message:string){
  if(error)throw new OfficeBudgetError(503,error.message||message);
}

export async function getBudgetOverview(){
  const capabilities={
    read:await can("finance.budget.read"),
    manage:await can("finance.budget.manage"),
    review:await can("finance.budget.review"),
    commit:await can("finance.budget.commit"),
    actual:await can("finance.budget.actual"),
  };
  if(!capabilities.read&&!capabilities.manage&&!capabilities.review&&!capabilities.commit&&!capabilities.actual){
    throw new OfficeBudgetError(403,"Budget workspace is not assigned to your current authority");
  }

  const current=await authority("finance.budget.read");
  const scopeType=current.decision.scopeType||"COMPANY";
  const department=current.department;

  const cycles=await current.admin.from("office_budget_cycles")
    .select("id,cycle_code,title,period_start,period_end,status,created_by,reviewed_by,reviewed_at,review_note,created_at,updated_at")
    .order("period_start",{ascending:false}).limit(200);
  fail(cycles.error,"Budget cycles are temporarily unavailable");

  let budgetQuery=current.admin.from("office_budgets")
    .select("id,budget_code,cycle_id,scope_type,scope_key,category,currency,allocation_minor,status,created_by,reviewed_by,reviewed_at,review_note,created_at,updated_at")
    .order("created_at",{ascending:false}).limit(1000);
  if(scopeType==="DEPARTMENT"&&department){
    budgetQuery=budgetQuery.or("scope_type.eq.COMPANY,and(scope_type.eq.DEPARTMENT,scope_key.eq."+department+")");
  }
  const budgets=await budgetQuery;
  fail(budgets.error,"Budget allocations are temporarily unavailable");

  const budgetIds=(budgets.data||[]).map(row=>String(row.id));
  const [adjustments,commitments,actuals,people] = await Promise.all([
    budgetIds.length
      ? current.admin.from("office_budget_adjustments")
          .select("id,adjustment_code,budget_id,delta_minor,reason,evidence_reference,status,requested_by,reviewed_by,reviewed_at,review_note,created_at")
          .in("budget_id",budgetIds).order("created_at",{ascending:false}).limit(1500)
      : Promise.resolve({data:[],error:null}),
    budgetIds.length
      ? current.admin.from("office_budget_commitments")
          .select("id,commitment_code,budget_id,source_type,source_reference,description,amount_minor,currency,approval_reference,status,created_by,released_by,released_at,release_reason,created_at,updated_at")
          .in("budget_id",budgetIds).order("created_at",{ascending:false}).limit(2000)
      : Promise.resolve({data:[],error:null}),
    budgetIds.length
      ? current.admin.from("office_budget_actuals")
          .select("id,actual_code,budget_id,commitment_id,source_type,source_reference,description,amount_minor,currency,evidence_reference,recorded_by,recorded_at")
          .in("budget_id",budgetIds).order("recorded_at",{ascending:false}).limit(2500)
      : Promise.resolve({data:[],error:null}),
    capabilities.manage||capabilities.review||capabilities.actual
      ? current.admin.from("office_identity_users")
          .select("user_id,display_name,job_title,primary_department,status")
          .eq("status","ACTIVE").order("display_name")
      : Promise.resolve({data:[],error:null}),
  ]);
  for(const result of [adjustments,commitments,actuals,people])fail(result.error,"Budget data is temporarily unavailable");

  const computed=await Promise.all((budgets.data||[]).map(async row=>{
    if(row.status!=="APPROVED")return {...row,available_minor:null};
    const {data,error}=await current.admin.rpc("office_budget_available",{p_budget:row.id});
    if(error)throw new OfficeBudgetError(503,error.message||"Available budget calculation failed");
    return {...row,available_minor:typeof data==="number"?data:Number(data||0)};
  }));

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles,department:current.identity.department||null},
    scope:{type:scopeType,key:department},
    capabilities,
    cycles:cycles.data||[],
    budgets:computed,
    adjustments:adjustments.data||[],
    commitments:commitments.data||[],
    actuals:actuals.data||[],
    people:people.data||[],
    disclaimer:"Budget approvals, commitments and actuals are accounting controls. This workspace does not execute a bank payment. Actuals require an external/source evidence reference, and commitments require upstream approval references.",
  };
}

export async function createBudgetCycle(input:{title:string;start:string;end:string}){
  const current=await authority("finance.budget.manage");
  const {data,error}=await current.admin.rpc("office_budget_cycle_create",{p_actor:current.identity.userId,p_title:input.title,p_start:input.start,p_end:input.end});
  if(error||typeof data!=="string")throw new OfficeBudgetError(400,error?.message||"Unable to create budget cycle");
  return {cycle_id:data};
}

export async function transitionBudgetCycle(input:{cycleId:string;status:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_budget_cycle_transition",{p_actor:current.identity.userId,p_cycle:input.cycleId,p_status:input.status,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeBudgetError(400,error?.message||"Unable to transition budget cycle");
  return {status:data};
}

export async function createBudget(input:{cycleId:string;scopeType:string;scopeKey?:string;category:string;currency:string;allocationMinor:number}){
  const current=await authority("finance.budget.manage");
  const {data,error}=await current.admin.rpc("office_budget_create",{p_actor:current.identity.userId,p_cycle:input.cycleId,p_scope_type:input.scopeType,p_scope_key:input.scopeKey?.trim()||null,p_category:input.category,p_currency:input.currency,p_allocation:input.allocationMinor});
  if(error||typeof data!=="string")throw new OfficeBudgetError(400,error?.message||"Unable to create budget allocation");
  return {budget_id:data};
}

export async function transitionBudget(input:{budgetId:string;status:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_budget_transition",{p_actor:current.identity.userId,p_budget:input.budgetId,p_status:input.status,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeBudgetError(400,error?.message||"Unable to transition budget allocation");
  return {status:data};
}

export async function requestBudgetAdjustment(input:{budgetId:string;deltaMinor:number;reason:string;evidence?:string}){
  const current=await authority("finance.budget.manage");
  const {data,error}=await current.admin.rpc("office_budget_adjustment_request",{p_actor:current.identity.userId,p_budget:input.budgetId,p_delta:input.deltaMinor,p_reason:input.reason,p_evidence:input.evidence?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeBudgetError(400,error?.message||"Unable to request budget adjustment");
  return {adjustment_id:data};
}

export async function reviewBudgetAdjustment(input:{adjustmentId:string;status:string;note?:string}){
  const current=await authority("finance.budget.review");
  const {data,error}=await current.admin.rpc("office_budget_adjustment_review",{p_actor:current.identity.userId,p_adjustment:input.adjustmentId,p_status:input.status,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeBudgetError(400,error?.message||"Unable to review budget adjustment");
  return {status:data};
}

export async function createBudgetCommitment(input:{budgetId:string;sourceType:string;sourceReference:string;description:string;amountMinor:number;currency:string;approvalReference:string}){
  const current=await authority("finance.budget.commit");
  const {data,error}=await current.admin.rpc("office_budget_commit",{p_actor:current.identity.userId,p_budget:input.budgetId,p_source_type:input.sourceType,p_source_reference:input.sourceReference,p_description:input.description,p_amount:input.amountMinor,p_currency:input.currency,p_approval_reference:input.approvalReference});
  if(error||typeof data!=="string")throw new OfficeBudgetError(400,error?.message||"Unable to reserve budget");
  return {commitment_id:data};
}

export async function releaseBudgetCommitment(input:{commitmentId:string;reason:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_budget_release_commitment",{p_actor:current.identity.userId,p_commitment:input.commitmentId,p_reason:input.reason});
  if(error||typeof data!=="string")throw new OfficeBudgetError(400,error?.message||"Unable to release budget commitment");
  return {status:data};
}

export async function recordBudgetActual(input:{budgetId:string;commitmentId?:string;sourceType:string;sourceReference:string;description:string;amountMinor:number;currency:string;evidence:string}){
  const current=await authority("finance.budget.actual");
  const {data,error}=await current.admin.rpc("office_budget_record_actual",{p_actor:current.identity.userId,p_budget:input.budgetId,p_commitment:input.commitmentId??null,p_source_type:input.sourceType,p_source_reference:input.sourceReference,p_description:input.description,p_amount:input.amountMinor,p_currency:input.currency,p_evidence:input.evidence});
  if(error||typeof data!=="string")throw new OfficeBudgetError(400,error?.message||"Unable to record budget actual");
  return {actual_id:data};
}
