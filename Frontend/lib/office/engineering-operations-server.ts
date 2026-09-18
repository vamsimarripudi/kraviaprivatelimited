import "server-only";

import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeEngineeringOperationsError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeEngineeringOperationsError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type ServiceRow={id:string;service_code:string;name:string;project_key:string;environment:string;owner_team?:string|null;status:string};

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeEngineeringOperationsError(error.status,error.message);
    throw error;
  }
}
async function decision(current:Actor,code:string,project:string){
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  return resolveOfficePermission(current.admin,current.identity,code,{type:"PROJECT",key:project},device);
}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeEngineeringOperationsError(503,error.message||message)}

async function serviceFor(current:Actor,serviceId:string){
  const result=await current.admin.from("office_engineering_services")
    .select("id,service_code,name,project_key,environment,owner_team,status")
    .eq("id",serviceId).maybeSingle();
  if(result.error||!result.data||result.data.status==="RETIRED")throw new OfficeEngineeringOperationsError(404,"Engineering service not found");
  return result.data as ServiceRow;
}

export async function getEngineeringOperationsOverview(){
  const current=await actor();
  const serviceResult=await current.admin.from("office_engineering_services")
    .select("id,service_code,name,project_key,environment,owner_team,status")
    .neq("status","RETIRED").order("project_key").order("name").limit(300);
  fail(serviceResult.error,"Engineering services are temporarily unavailable");

  const access=await Promise.all(((serviceResult.data||[]) as ServiceRow[]).map(async service=>{
    const [oncallRead,oncallManage,maintenanceRead,maintenanceManage,maintenanceApprove,maintenanceVerify,infrastructureRead,infrastructureChange]=await Promise.all([
      decision(current,"engineering.oncall.read",service.project_key),
      decision(current,"engineering.oncall.manage",service.project_key),
      decision(current,"engineering.maintenance.read",service.project_key),
      decision(current,"engineering.maintenance.manage",service.project_key),
      decision(current,"engineering.maintenance.approve",service.project_key),
      decision(current,"engineering.maintenance.verify",service.project_key),
      decision(current,"engineering.infrastructure.read",service.project_key),
      decision(current,"engineering.infrastructure.change",service.project_key),
    ]);
    return {service,permissions:{
      oncall_read:oncallRead.allowed&&infrastructureRead.allowed,
      oncall_manage:oncallManage.allowed&&infrastructureRead.allowed,
      maintenance_read:maintenanceRead.allowed&&infrastructureRead.allowed,
      maintenance_manage:maintenanceManage.allowed&&infrastructureChange.allowed,
      maintenance_approve:maintenanceApprove.allowed&&infrastructureRead.allowed,
      maintenance_verify:maintenanceVerify.allowed&&infrastructureRead.allowed,
    }};
  }));

  const visible=access.filter(row=>row.permissions.oncall_read||row.permissions.maintenance_read);
  if(!visible.length)throw new OfficeEngineeringOperationsError(403,"Engineering operations are not assigned to your current project scope");
  const ids=visible.map(row=>row.service.id);

  const [rotations,maintenance,profileAssignments]=await Promise.all([
    current.admin.from("office_oncall_rotations")
      .select("id,rotation_code,service_id,primary_user_id,secondary_user_id,starts_at,ends_at,status,note,created_by,cancelled_by,cancelled_at,created_at,updated_at")
      .in("service_id",ids).order("starts_at",{ascending:false}).limit(1500),
    current.admin.from("office_maintenance_windows")
      .select("id,maintenance_code,service_id,title,reason,expected_impact,implementation_plan,rollback_plan,owner_user_id,starts_at,ends_at,status,approval_reference,approved_by,approved_at,verification_evidence_reference,health_reference,verified_by,verified_at,created_by,created_at,updated_at")
      .in("service_id",ids).order("starts_at",{ascending:false}).limit(1500),
    current.admin.from("office_user_access_profiles")
      .select("user_id,profile_code,status,expires_at")
      .in("profile_code",["DEVELOPER_STANDARD","DEVELOPER_SENIOR","DEVOPS_OPERATOR","ENGINEERING_MANAGER","QA_ENGINEER","SECURITY_OPERATOR"])
      .eq("status","ACTIVE").limit(3000),
  ]);
  fail(rotations.error,"On-call rotations are temporarily unavailable");
  fail(maintenance.error,"Maintenance windows are temporarily unavailable");
  fail(profileAssignments.error,"Engineering identity assignments are temporarily unavailable");

  const rotationIds=(rotations.data||[]).map(row=>String(row.id));
  const maintenanceIds=(maintenance.data||[]).map(row=>String(row.id));
  const clauses:string[]=[];
  if(rotationIds.length)clauses.push("rotation_id.in.("+rotationIds.join(",")+")");
  if(maintenanceIds.length)clauses.push("maintenance_id.in.("+maintenanceIds.join(",")+")");
  const eventResult=clauses.length
    ? await current.admin.from("office_engineering_operations_events")
        .select("id,actor_user_id,rotation_id,maintenance_id,event_type,previous_status,new_status,note,metadata,created_at")
        .or(clauses.join(",")).order("created_at",{ascending:false}).limit(3000)
    : {data:[],error:null};
  fail(eventResult.error,"Engineering operations history is temporarily unavailable");

  const now=Date.now();
  const engineerIds=[...new Set((profileAssignments.data||[])
    .filter(row=>!row.expires_at||Date.parse(String(row.expires_at))>now)
    .map(row=>String(row.user_id)))];
  const people=engineerIds.length
    ? await current.admin.from("office_identity_users")
        .select("user_id,display_name,job_title,primary_department,status")
        .in("user_id",engineerIds).eq("status","ACTIVE").order("display_name")
    : {data:[],error:null};
  fail(people.error,"Engineering identities are temporarily unavailable");

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles},
    generated_at:new Date().toISOString(),
    services:visible,
    rotations:(rotations.data||[]).map(row=>({
      ...row,
      is_current:row.status==="SCHEDULED"&&Date.parse(String(row.starts_at))<=now&&Date.parse(String(row.ends_at))>now,
    })),
    maintenance:maintenance.data||[],
    events:eventResult.data||[],
    people:people.data||[],
    disclaimer:"On-call schedules and maintenance windows are governance records. Creating or approving a maintenance window does not itself execute provider infrastructure changes or deployments.",
  };
}

export async function createOncallRotation(input:{serviceId:string;primaryUserId:string;secondaryUserId?:string;startsAt:string;endsAt:string;note?:string}){
  const current=await actor();const service=await serviceFor(current,input.serviceId);
  const permission=await decision(current,"engineering.oncall.manage",service.project_key);
  if(!permission.allowed)throw new OfficeEngineeringOperationsError(403,permission.reason);
  const {data,error}=await current.admin.rpc("office_oncall_create",{p_actor:current.identity.userId,p_service:service.id,p_primary:input.primaryUserId,p_secondary:input.secondaryUserId??null,p_start:input.startsAt,p_end:input.endsAt,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeEngineeringOperationsError(400,error?.message||"Unable to create on-call rotation");
  return {rotation_id:data};
}
export async function cancelOncallRotation(input:{rotationId:string;reason:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_oncall_cancel",{p_actor:current.identity.userId,p_rotation:input.rotationId,p_reason:input.reason});
  if(error||data!==true)throw new OfficeEngineeringOperationsError(400,error?.message||"Unable to cancel on-call rotation");
  return {cancelled:true};
}
export async function createMaintenanceWindow(input:{serviceId:string;title:string;reason:string;impact:string;implementation:string;rollback:string;ownerUserId:string;startsAt:string;endsAt:string}){
  const current=await actor();const service=await serviceFor(current,input.serviceId);
  const [manage,infrastructure]=await Promise.all([
    decision(current,"engineering.maintenance.manage",service.project_key),
    decision(current,"engineering.infrastructure.change",service.project_key),
  ]);
  if(!manage.allowed)throw new OfficeEngineeringOperationsError(403,manage.reason);
  if(!infrastructure.allowed)throw new OfficeEngineeringOperationsError(403,infrastructure.reason);
  const {data,error}=await current.admin.rpc("office_maintenance_create",{p_actor:current.identity.userId,p_service:service.id,p_title:input.title,p_reason:input.reason,p_impact:input.impact,p_implementation:input.implementation,p_rollback:input.rollback,p_owner:input.ownerUserId,p_start:input.startsAt,p_end:input.endsAt});
  if(error||typeof data!=="string")throw new OfficeEngineeringOperationsError(400,error?.message||"Unable to propose maintenance window");
  return {maintenance_id:data};
}
export async function reviewMaintenanceWindow(input:{maintenanceId:string;decision:string;reference?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_maintenance_review",{p_actor:current.identity.userId,p_maintenance:input.maintenanceId,p_decision:input.decision,p_reference:input.reference?.trim()||null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeEngineeringOperationsError(400,error?.message||"Unable to review maintenance window");
  return {status:data};
}
export async function executeMaintenanceWindow(input:{maintenanceId:string;action:string;evidence?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_maintenance_execute",{p_actor:current.identity.userId,p_maintenance:input.maintenanceId,p_action:input.action,p_evidence:input.evidence?.trim()||null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeEngineeringOperationsError(400,error?.message||"Unable to update maintenance execution");
  return {status:data};
}
export async function verifyMaintenanceWindow(input:{maintenanceId:string;evidence:string;health:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_maintenance_verify",{p_actor:current.identity.userId,p_maintenance:input.maintenanceId,p_evidence:input.evidence,p_health:input.health,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeEngineeringOperationsError(400,error?.message||"Unable to verify maintenance");
  return {status:data};
}
