import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeAiGovernanceError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeAiGovernanceError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type Authority=Actor&{decision:OfficePermissionDecision;department:string|null};

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeAiGovernanceError(error.status,error.message);
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
  throw new OfficeAiGovernanceError(403,last?.reason||"AI governance permission is required");
}
async function can(code:string){try{await authority(code);return true}catch(error){if(error instanceof OfficeAiGovernanceError&&error.status===403)return false;throw error}}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeAiGovernanceError(503,error.message||message)}

export async function getAiGovernanceOverview(){
  const capabilities={
    tool_read:await can("ai.tool.read"),
    tool_manage:await can("ai.tool.manage"),
    tool_review:await can("ai.tool.review"),
    use_request:await can("ai.use.request"),
    use_read:await can("ai.use.read"),
    use_review:await can("ai.use.review"),
    usage_audit:await can("ai.usage.audit"),
  };
  if(!capabilities.tool_read&&!capabilities.use_request&&!capabilities.use_read)throw new OfficeAiGovernanceError(403,"AI Governance is not assigned to your current authority");
  const current=capabilities.use_read?await authority("ai.use.read"):await authority("ai.tool.read");

  let toolsQuery=current.admin.from("office_ai_tools")
    .select("id,tool_code,provider_name,tool_name,purpose,external_service,allowed_data_classes,prohibited_data_classes,retention_policy,provider_training_policy,data_residency,privacy_security_reference,human_review_required,status,owner_user_id,created_by,reviewed_by,reviewed_at,review_note,expires_on,created_at,updated_at")
    .order("provider_name").limit(500);
  if(!capabilities.tool_manage&&!capabilities.tool_review)toolsQuery=toolsQuery.eq("status","APPROVED");
  const tools=capabilities.tool_read?await toolsQuery:{data:[],error:null};
  fail(tools.error,"AI tool registry is temporarily unavailable");

  let useQuery=current.admin.from("office_ai_use_cases")
    .select("id,use_case_code,requester_user_id,department_code,tool_id,title,purpose,intended_data_classes,action_mode,human_review_required,status,reviewer_user_id,reviewed_at,review_note,expires_at,created_at,updated_at")
    .order("created_at",{ascending:false}).limit(1000);
  if(current.decision.scopeType==="OWN")useQuery=useQuery.eq("requester_user_id",current.identity.userId);
  else if(current.decision.scopeType==="DEPARTMENT"&&current.department)useQuery=useQuery.eq("department_code",current.department);
  const uses=capabilities.use_read?await useQuery:{data:[],error:null};
  fail(uses.error,"AI use cases are temporarily unavailable");

  const useIds=(uses.data||[]).map(row=>String(row.id));
  const usage=capabilities.usage_audit&&useIds.length
    ? await current.admin.from("office_ai_usage_events")
        .select("id,use_case_id,actor_user_id,action_kind,data_classes,content_sha256,provider_reference,result_reference,human_review_reference,created_at")
        .in("use_case_id",useIds).order("created_at",{ascending:false}).limit(2500)
    : {data:[],error:null};
  fail(usage.error,"AI usage metadata is temporarily unavailable");

  const people=(capabilities.tool_manage||capabilities.tool_review||capabilities.use_review)
    ? await current.admin.from("office_identity_users")
        .select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name")
    : {data:[],error:null};
  fail(people.error,"Office identities are temporarily unavailable");

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles,department:current.identity.department||null},
    scope:{type:current.decision.scopeType||null,key:current.department},
    capabilities,
    tools:tools.data||[],
    use_cases:uses.data||[],
    usage_events:usage.data||[],
    people:people.data||[],
    disclaimer:"AI Governance records approved providers, data classifications, expiry and human-review requirements. This workspace does not invoke an AI provider, store raw prompts/outputs, or claim a provider is safe beyond the evidence recorded in its approved tool assessment.",
  };
}

export async function createAiTool(input:{
  provider:string;tool:string;purpose:string;external:boolean;allowed:string[];prohibited:string[];
  retention:string;trainingPolicy:string;residency?:string;reference?:string;humanReview:boolean;ownerUserId:string;expiresOn?:string;
}){
  const current=await authority("ai.tool.manage");
  const {data,error}=await current.admin.rpc("office_ai_tool_create",{
    p_actor:current.identity.userId,p_provider:input.provider,p_tool:input.tool,p_purpose:input.purpose,p_external:input.external,
    p_allowed:input.allowed,p_prohibited:input.prohibited,p_retention:input.retention,p_training:input.trainingPolicy,
    p_residency:input.residency?.trim()||null,p_reference:input.reference?.trim()||null,p_human_review:input.humanReview,
    p_owner:input.ownerUserId,p_expires:input.expiresOn??null,
  });
  if(error||typeof data!=="string")throw new OfficeAiGovernanceError(400,error?.message||"Unable to create AI tool review");
  return {tool_id:data};
}
export async function transitionAiTool(input:{toolId:string;status:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_ai_tool_transition",{p_actor:current.identity.userId,p_tool:input.toolId,p_status:input.status,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeAiGovernanceError(400,error?.message||"Unable to transition AI tool");
  return {status:data};
}
export async function requestAiUse(input:{toolId:string;title:string;purpose:string;classes:string[];mode:string;humanReview:boolean}){
  const current=await authority("ai.use.request");
  const {data,error}=await current.admin.rpc("office_ai_use_request",{p_actor:current.identity.userId,p_tool:input.toolId,p_title:input.title,p_purpose:input.purpose,p_classes:input.classes,p_mode:input.mode,p_human_review:input.humanReview});
  if(error||typeof data!=="string")throw new OfficeAiGovernanceError(400,error?.message||"Unable to request AI use case");
  return {use_case_id:data};
}
export async function reviewAiUse(input:{useCaseId:string;status:string;expiresAt?:string;note?:string}){
  const current=await authority("ai.use.review");
  const {data,error}=await current.admin.rpc("office_ai_use_review",{p_actor:current.identity.userId,p_use:input.useCaseId,p_status:input.status,p_expires:input.expiresAt??null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeAiGovernanceError(400,error?.message||"Unable to review AI use case");
  return {status:data};
}
export async function recordAiUsage(input:{useCaseId:string;actionKind:string;classes:string[];contentSha256?:string;providerReference?:string;resultReference?:string;humanReviewReference?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_ai_usage_record",{
    p_actor:current.identity.userId,p_use:input.useCaseId,p_action:input.actionKind,p_classes:input.classes,
    p_content_sha256:input.contentSha256?.trim()||null,p_provider_reference:input.providerReference?.trim()||null,
    p_result_reference:input.resultReference?.trim()||null,p_human_review_reference:input.humanReviewReference?.trim()||null,
  });
  if(error||typeof data!=="number")throw new OfficeAiGovernanceError(400,error?.message||"Unable to record AI usage metadata");
  return {usage_event_id:data};
}
