import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeQualityError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeQualityError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type Authority=Actor&{decision:OfficePermissionDecision;department:string|null};

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeQualityError(error.status,error.message);
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
  throw new OfficeQualityError(403,last?.reason||"Quality permission is required");
}
async function can(code:string){try{await authority(code);return true}catch(error){if(error instanceof OfficeQualityError&&error.status===403)return false;throw error}}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeQualityError(503,error.message||message)}

export async function getQualityOverview(){
  const capabilities={
    read:await can("quality.read"),
    process_manage:await can("quality.process.manage"),
    process_publish:await can("quality.process.publish"),
    report:await can("quality.nonconformance.report"),
    nc_manage:await can("quality.nonconformance.manage"),
    capa_manage:await can("quality.capa.manage"),
    capa_review:await can("quality.capa.review"),
  };
  if(!capabilities.read&&!capabilities.report)throw new OfficeQualityError(403,"Quality workspace is not assigned to your current authority");
  const current=capabilities.read?await authority("quality.read"):await authority("quality.nonconformance.report");
  const own=current.decision.scopeType==="OWN";
  const department=current.decision.scopeType==="DEPARTMENT"?current.department:null;

  let processQuery=current.admin.from("office_quality_processes")
    .select("id,process_code,title,department_code,owner_user_id,status,current_version,next_review_on,created_by,created_at,updated_at")
    .order("title").limit(1000);
  if(own){
    if(current.identity.department)processQuery=processQuery.eq("department_code",current.identity.department).eq("status","PUBLISHED");
    else processQuery=processQuery.eq("status","PUBLISHED");
  }else if(department){
    processQuery=processQuery.eq("department_code",department);
  }

  let ncQuery=current.admin.from("office_quality_nonconformances")
    .select("id,nc_code,process_id,reporter_user_id,department_code,source_type,severity,title,description,evidence_reference,immediate_containment,owner_user_id,status,created_at,updated_at,closed_at")
    .order("created_at",{ascending:false}).limit(2000);
  if(own)ncQuery=ncQuery.or("reporter_user_id.eq."+current.identity.userId+",owner_user_id.eq."+current.identity.userId);
  else if(department)ncQuery=ncQuery.eq("department_code",department);

  const [processes,ncs]=await Promise.all([processQuery,ncQuery]);
  fail(processes.error,"Quality processes are temporarily unavailable");
  fail(ncs.error,"Nonconformance records are temporarily unavailable");

  const processIds=(processes.data||[]).map(row=>String(row.id));
  const ncIds=(ncs.data||[]).map(row=>String(row.id));
  const [versions,capas,people]=await Promise.all([
    processIds.length
      ? current.admin.from("office_quality_process_versions")
          .select("id,process_id,version,purpose,scope_text,procedure_text,control_points,evidence_requirements,standard_reference,change_summary,content_sha256,status,created_by,published_by,published_at,created_at")
          .in("process_id",processIds)
          .in("status",capabilities.process_manage||capabilities.process_publish?["DRAFT","PUBLISHED","SUPERSEDED","RETIRED"]:["PUBLISHED"])
          .order("version",{ascending:false}).limit(3000)
      : Promise.resolve({data:[],error:null}),
    ncIds.length
      ? current.admin.from("office_quality_capas")
          .select("id,capa_code,nonconformance_id,action_type,owner_user_id,root_cause,action_plan,due_on,status,completion_evidence_reference,effectiveness_evidence_reference,reviewer_user_id,reviewed_at,review_note,created_by,created_at,updated_at")
          .in("nonconformance_id",ncIds).order("due_on",{ascending:true,nullsFirst:false}).limit(3000)
      : Promise.resolve({data:[],error:null}),
    capabilities.process_manage||capabilities.process_publish||capabilities.nc_manage||capabilities.capa_manage||capabilities.capa_review
      ? (department
          ? current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").eq("primary_department",department).order("display_name")
          : current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name").limit(3000))
      : Promise.resolve({data:[],error:null}),
  ]);
  for(const result of [versions,capas,people])fail(result.error,"Quality supporting records are temporarily unavailable");

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles,department:current.identity.department||null},
    scope:{type:current.decision.scopeType||null,key:department},
    capabilities,
    processes:processes.data||[],
    process_versions:versions.data||[],
    nonconformances:ncs.data||[],
    capas:capas.data||[],
    people:people.data||[],
    disclaimer:"Quality records are evidence-backed human decisions. KRAVIA does not calculate employee or quality scores from login duration, commits, activity telemetry or task counts.",
  };
}

export async function createQualityProcess(input:{title:string;department:string;ownerUserId:string;purpose:string;scope:string;procedure:string;controls:string[];evidenceRequirements:string[];standardReference?:string;nextReviewOn?:string}){
  const current=await authority("quality.process.manage");
  const {data,error}=await current.admin.rpc("office_quality_process_create",{
    p_actor:current.identity.userId,p_title:input.title,p_department:input.department,p_owner:input.ownerUserId,p_purpose:input.purpose,p_scope:input.scope,
    p_procedure:input.procedure,p_controls:input.controls,p_evidence:input.evidenceRequirements,p_standard:input.standardReference?.trim()||null,p_review_on:input.nextReviewOn??null,
  });
  if(error||typeof data!=="string")throw new OfficeQualityError(400,error?.message||"Unable to create quality process");
  return {process_id:data};
}
export async function createQualityProcessVersion(input:{processId:string;purpose:string;scope:string;procedure:string;controls:string[];evidenceRequirements:string[];standardReference?:string;changeSummary?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_quality_process_new_version",{
    p_actor:current.identity.userId,p_process:input.processId,p_purpose:input.purpose,p_scope:input.scope,p_procedure:input.procedure,
    p_controls:input.controls,p_evidence:input.evidenceRequirements,p_standard:input.standardReference?.trim()||null,p_summary:input.changeSummary?.trim()||null,
  });
  if(error||typeof data!=="string")throw new OfficeQualityError(400,error?.message||"Unable to create process revision");
  return {process_version_id:data};
}
export async function publishQualityProcess(input:{versionId:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_quality_process_publish",{p_actor:current.identity.userId,p_version:input.versionId});
  if(error||data!==true)throw new OfficeQualityError(400,error?.message||"Unable to publish process revision");
  return {published:true};
}
export async function reportNonconformance(input:{processId?:string;source:string;severity:string;title:string;description:string;evidence?:string}){
  const current=await authority("quality.nonconformance.report");
  const {data,error}=await current.admin.rpc("office_quality_nc_report",{
    p_actor:current.identity.userId,p_process:input.processId??null,p_source:input.source,p_severity:input.severity,p_title:input.title,p_description:input.description,p_evidence:input.evidence?.trim()||null,
  });
  if(error||typeof data!=="string")throw new OfficeQualityError(400,error?.message||"Unable to report nonconformance");
  return {nonconformance_id:data};
}
export async function manageNonconformance(input:{nonconformanceId:string;status:string;ownerUserId?:string;containment?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_quality_nc_manage",{
    p_actor:current.identity.userId,p_nc:input.nonconformanceId,p_status:input.status,p_owner:input.ownerUserId??null,p_containment:input.containment?.trim()||null,p_note:input.note?.trim()||null,
  });
  if(error||typeof data!=="string")throw new OfficeQualityError(400,error?.message||"Unable to manage nonconformance");
  return {status:data};
}
export async function closeNonconformance(input:{nonconformanceId:string;evidence:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_quality_nc_close",{p_actor:current.identity.userId,p_nc:input.nonconformanceId,p_evidence:input.evidence,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeQualityError(400,error?.message||"Unable to close nonconformance");
  return {status:data};
}
export async function createCapa(input:{nonconformanceId:string;type:string;ownerUserId:string;rootCause:string;actionPlan:string;dueOn?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_quality_capa_create",{p_actor:current.identity.userId,p_nc:input.nonconformanceId,p_type:input.type,p_owner:input.ownerUserId,p_root_cause:input.rootCause,p_action_plan:input.actionPlan,p_due:input.dueOn??null});
  if(error||typeof data!=="string")throw new OfficeQualityError(400,error?.message||"Unable to create CAPA");
  return {capa_id:data};
}
export async function transitionCapa(input:{capaId:string;status:string;completionEvidence?:string;effectivenessEvidence?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_quality_capa_transition",{p_actor:current.identity.userId,p_capa:input.capaId,p_status:input.status,p_completion_evidence:input.completionEvidence?.trim()||null,p_effectiveness_evidence:input.effectivenessEvidence?.trim()||null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeQualityError(400,error?.message||"Unable to transition CAPA");
  return {status:data};
}
