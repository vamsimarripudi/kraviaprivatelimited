import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeResilienceError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeResilienceError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type Authority=Actor&{decision:OfficePermissionDecision};

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeResilienceError(error.status,error.message);
    throw error;
  }
}
async function authority(code:string):Promise<Authority>{
  const current=await actor();
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  const scopes:OfficeResourceScope[]=[
    {type:"COMPANY"},
    ...(current.identity.department?[{type:"DEPARTMENT" as const,key:current.identity.department}]:[]),
    {type:"OWN",key:current.identity.userId},
  ];
  let last:OfficePermissionDecision|undefined;
  for(const scope of scopes){
    const decision=await resolveOfficePermission(current.admin,current.identity,code,scope,device);
    if(decision.allowed)return {...current,decision};
    last=decision;
  }
  throw new OfficeResilienceError(403,last?.reason||"Resilience permission is required");
}
async function can(code:string){try{await authority(code);return true}catch(error){if(error instanceof OfficeResilienceError&&error.status===403)return false;throw error}}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeResilienceError(503,error.message||message)}

export async function getResilienceOverview(){
  const current=await actor();
  const capabilities={
    resilience_read:await can("resilience.read"),
    plan_manage:await can("resilience.plan.manage"),
    plan_review:await can("resilience.plan.review"),
    test_manage:await can("resilience.test.manage"),
    test_review:await can("resilience.test.review"),
    incident_report:await can("resilience.incident.report"),
    incident_read:await can("resilience.incident.read"),
    incident_manage:await can("resilience.incident.manage"),
    insurance_read:await can("insurance.read"),
    insurance_manage:await can("insurance.manage"),
    insurance_review:await can("insurance.review"),
  };
  if(!capabilities.resilience_read&&!capabilities.incident_read&&!capabilities.incident_report&&!capabilities.insurance_read){
    throw new OfficeResilienceError(403,"Resilience workspace is not assigned to your current authority");
  }

  const incidentAuthority=capabilities.incident_read?await authority("resilience.incident.read"):null;
  let incidentQuery=current.admin.from("office_emergency_incidents")
    .select("id,incident_code,reporter_user_id,site_id,category,severity,title,description,status,incident_commander_user_id,containment_summary,recovery_summary,evidence_reference,opened_at,contained_at,resolved_at,closed_at,updated_at")
    .order("opened_at",{ascending:false}).limit(1000);
  if(incidentAuthority?.decision.scopeType==="OWN")incidentQuery=incidentQuery.eq("reporter_user_id",current.identity.userId);
  const [plans,tests,incidents,policies,claims,people,sites]=await Promise.all([
    capabilities.resilience_read
      ? current.admin.from("office_continuity_plans").select("id,plan_code,title,plan_type,criticality,owner_user_id,scope_text,recovery_order,fallback_procedure,communication_plan,rto_minutes,rpo_minutes,next_test_on,version,status,created_by,reviewed_by,reviewed_at,review_note,created_at,updated_at").order("updated_at",{ascending:false}).limit(500)
      : Promise.resolve({data:[],error:null}),
    capabilities.resilience_read
      ? current.admin.from("office_resilience_tests").select("id,test_code,plan_id,test_type,owner_user_id,scheduled_on,conducted_at,status,result_summary,evidence_reference,reviewer_user_id,reviewed_at,created_by,created_at,updated_at").order("scheduled_on",{ascending:false}).limit(1000)
      : Promise.resolve({data:[],error:null}),
    capabilities.incident_read?incidentQuery:Promise.resolve({data:[],error:null}),
    capabilities.insurance_read
      ? current.admin.from("office_insurance_policies").select("id,policy_code,insurance_type,provider_name,provider_policy_reference,coverage_summary,premium_paise,currency,effective_on,expires_on,owner_user_id,document_reference,status,created_by,created_at,updated_at").order("expires_on",{ascending:true}).limit(500)
      : Promise.resolve({data:[],error:null}),
    capabilities.insurance_read
      ? current.admin.from("office_insurance_claims").select("id,claim_code,policy_id,emergency_incident_id,reported_by,owner_user_id,claim_amount_paise,currency,description,evidence_reference,insurer_reference,status,reviewed_by,reviewed_at,review_note,payment_reference,paid_at,created_at,updated_at").order("created_at",{ascending:false}).limit(1000)
      : Promise.resolve({data:[],error:null}),
    (capabilities.plan_manage||capabilities.plan_review||capabilities.test_manage||capabilities.test_review||capabilities.incident_manage||capabilities.insurance_manage||capabilities.insurance_review)
      ? current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name")
      : Promise.resolve({data:[],error:null}),
    capabilities.incident_report||capabilities.incident_manage
      ? current.admin.from("office_facility_sites").select("id,site_code,name,status").eq("status","ACTIVE").order("name")
      : Promise.resolve({data:[],error:null}),
  ]);
  for(const result of [plans,tests,incidents,policies,claims,people,sites])fail(result.error,"Resilience records are temporarily unavailable");

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles,department:current.identity.department||null},
    capabilities,
    plans:plans.data||[],
    tests:tests.data||[],
    incidents:incidents.data||[],
    policies:policies.data||[],
    claims:claims.data||[],
    people:people.data||[],
    sites:sites.data||[],
    disclaimer:"KRAVIA records continuity plans, tests, emergency evidence and insurance workflow state. It does not certify regulatory compliance, insurer acceptance, recovery success, or actual claim payment without recorded evidence/reference.",
  };
}

export async function createContinuityPlan(input:{title:string;type:string;criticality:string;ownerUserId:string;scope:string;recoveryOrder:string;fallback:string;communication?:string;rtoMinutes?:number;rpoMinutes?:number;nextTestOn?:string}){
  const current=await authority("resilience.plan.manage");
  const {data,error}=await current.admin.rpc("office_continuity_plan_create",{
    p_actor:current.identity.userId,p_title:input.title,p_type:input.type,p_criticality:input.criticality,p_owner:input.ownerUserId,
    p_scope:input.scope,p_recovery_order:input.recoveryOrder,p_fallback:input.fallback,p_communication:input.communication?.trim()||null,
    p_rto:input.rtoMinutes??null,p_rpo:input.rpoMinutes??null,p_next_test:input.nextTestOn??null,
  });
  if(error||typeof data!=="string")throw new OfficeResilienceError(400,error?.message||"Unable to create continuity plan");
  return {plan_id:data};
}
export async function transitionContinuityPlan(input:{planId:string;status:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_continuity_plan_transition",{p_actor:current.identity.userId,p_plan:input.planId,p_status:input.status,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeResilienceError(400,error?.message||"Unable to transition continuity plan");
  return {status:data};
}
export async function createResilienceTest(input:{planId:string;type:string;ownerUserId:string;scheduledOn:string}){
  const current=await authority("resilience.test.manage");
  const {data,error}=await current.admin.rpc("office_resilience_test_create",{p_actor:current.identity.userId,p_plan:input.planId,p_type:input.type,p_owner:input.ownerUserId,p_scheduled:input.scheduledOn});
  if(error||typeof data!=="string")throw new OfficeResilienceError(400,error?.message||"Unable to create resilience test");
  return {test_id:data};
}
export async function transitionResilienceTest(input:{testId:string;status:string;summary?:string;evidence?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_resilience_test_transition",{p_actor:current.identity.userId,p_test:input.testId,p_status:input.status,p_summary:input.summary?.trim()||null,p_evidence:input.evidence?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeResilienceError(400,error?.message||"Unable to update resilience test");
  return {status:data};
}
export async function reportEmergencyIncident(input:{siteId?:string;category:string;severity:string;title:string;description:string}){
  const current=await authority("resilience.incident.report");
  const {data,error}=await current.admin.rpc("office_emergency_incident_report",{p_actor:current.identity.userId,p_site:input.siteId??null,p_category:input.category,p_severity:input.severity,p_title:input.title,p_description:input.description});
  if(error||typeof data!=="string")throw new OfficeResilienceError(400,error?.message||"Unable to report emergency incident");
  return {incident_id:data};
}
export async function transitionEmergencyIncident(input:{incidentId:string;status:string;commanderUserId?:string;containment?:string;recovery?:string;evidence?:string}){
  const current=await authority("resilience.incident.manage");
  const {data,error}=await current.admin.rpc("office_emergency_incident_transition",{p_actor:current.identity.userId,p_incident:input.incidentId,p_status:input.status,p_commander:input.commanderUserId??null,p_containment:input.containment?.trim()||null,p_recovery:input.recovery?.trim()||null,p_evidence:input.evidence?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeResilienceError(400,error?.message||"Unable to update emergency incident");
  return {status:data};
}
export async function createInsurancePolicy(input:{type:string;provider:string;policyReference:string;coverage:string;premiumPaise?:number;currency:string;effectiveOn:string;expiresOn:string;ownerUserId:string;documentReference:string}){
  const current=await authority("insurance.manage");
  const {data,error}=await current.admin.rpc("office_insurance_policy_create",{p_actor:current.identity.userId,p_type:input.type,p_provider:input.provider,p_policy_ref:input.policyReference,p_coverage:input.coverage,p_premium:input.premiumPaise??null,p_currency:input.currency,p_effective:input.effectiveOn,p_expiry:input.expiresOn,p_owner:input.ownerUserId,p_document:input.documentReference});
  if(error||typeof data!=="string")throw new OfficeResilienceError(400,error?.message||"Unable to create insurance policy");
  return {policy_id:data};
}
export async function createInsuranceClaim(input:{policyId:string;incidentId?:string;ownerUserId:string;amountPaise?:number;currency:string;description:string;evidence:string}){
  const current=await authority("insurance.manage");
  const {data,error}=await current.admin.rpc("office_insurance_claim_create",{p_actor:current.identity.userId,p_policy:input.policyId,p_incident:input.incidentId??null,p_owner:input.ownerUserId,p_amount:input.amountPaise??null,p_currency:input.currency,p_description:input.description,p_evidence:input.evidence});
  if(error||typeof data!=="string")throw new OfficeResilienceError(400,error?.message||"Unable to create insurance claim");
  return {claim_id:data};
}
export async function transitionInsuranceClaim(input:{claimId:string;status:string;note?:string;insurerReference?:string;paymentReference?:string}){
  const current=await authority("insurance.review");
  const {data,error}=await current.admin.rpc("office_insurance_claim_transition",{p_actor:current.identity.userId,p_claim:input.claimId,p_status:input.status,p_note:input.note?.trim()||null,p_insurer_reference:input.insurerReference?.trim()||null,p_payment_reference:input.paymentReference?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeResilienceError(400,error?.message||"Unable to review insurance claim");
  return {status:data};
}
