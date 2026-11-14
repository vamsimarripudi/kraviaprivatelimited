import "server-only";
import {requireOfficeActor,resolveOfficePermission,OfficePermissionError} from "@/lib/office/permission-engine";
import {currentOfficeTrustedDeviceId} from "@/lib/office/device-binding-server";

export class OfficeConnectGovernanceError extends Error{
 constructor(public readonly status:number,message:string){super(message);this.name="OfficeConnectGovernanceError"}
}
const codes=[
 "access.profile.assign","access.audit.read","audit.read",
 "it.service.request","it.service.read","it.service.manage",
 "support.case.read","support.case.manage",
 "document.instance.read","document.instance.review",
] as const;
const labels:Record<string,string>={
 "access.profile.assign":"Manage permission assignments",
 "access.audit.read":"Review access audit evidence",
 "audit.read":"Read independent audit evidence",
 "it.service.request":"Create employee IT ticket",
 "it.service.read":"Read scoped IT support",
 "it.service.manage":"Manage governed IT tickets",
 "support.case.read":"Read customer support cases",
 "support.case.manage":"Manage customer support cases",
 "document.instance.read":"Read permitted document instances",
 "document.instance.review":"Review assigned document requests",
};
/** Read-only IAM projection. No private DM, employee ticket or case bodies
 * are queried. Every source operation independently rechecks its own scope. */
export async function getOfficeConnectGovernance(){
 let current:Awaited<ReturnType<typeof requireOfficeActor>>;
 try{current=await requireOfficeActor()}
 catch(error){if(error instanceof OfficePermissionError)
  throw new OfficeConnectGovernanceError(error.status,error.message);throw error;}
 if(current.identity.workspaceStatus!=="ACTIVE")throw new OfficeConnectGovernanceError(403,"Active Office access is required");
 const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
 const gate=await Promise.all(["access.profile.assign","access.audit.read"].map(code=>
  resolveOfficePermission(current.admin,current.identity,code,{type:"COMPANY"},device)));
 if(!gate.some(decision=>decision.allowed))
  throw new OfficeConnectGovernanceError(403,"Independent access governance or audit capability required");
 const [catalog,profiles,decisions]=await Promise.all([
  current.admin.from("office_permission_catalog")
   .select("code,active,high_risk,requires_managed_device,owner_bypass").in("code",[...codes])
   .order("code"),
  current.admin.from("office_access_profile_permissions")
   .select("profile_code,permission_code,effect,default_scope_type")
   .in("permission_code",[...codes]).order("profile_code").limit(1000),
  Promise.all(codes.map(async code=>{
   const [company,own]=await Promise.all([
    resolveOfficePermission(current.admin,current.identity,code,{type:"COMPANY"},device),
    resolveOfficePermission(current.admin,current.identity,code,
     {type:"OWN",ownerUserId:current.identity.userId},device)
   ]);
   return {code,label:labels[code],company:{allowed:company.allowed,reason:company.reason,
       source:company.source??null,scope_type:company.scopeType??null},
    own:{allowed:own.allowed,reason:own.reason,source:own.source??null,
      scope_type:own.scopeType??null}};
  })),
 ]);
 if(catalog.error||profiles.error)throw new OfficeConnectGovernanceError(503,"IAM policy data is temporarily unavailable");
 return {scope:"EXPLANATORY_READ_ONLY" as const,generated_at:new Date().toISOString(),
  capabilities:decisions,policies:catalog.data??[],profile_mappings:profiles.data??[],
  disclaimer:"Canonical IAM and source-owned permissions decide every action. This register does not grant private message access, override department ownership, alter retention, approve work or expose other employees' messages."};
}

/** Governed inventory of department-channel *metadata*. No message bodies,
 * member names, direct-message titles, or project group content are queried. */
export async function getOfficeConnectChannelGovernance(){
 let current:Awaited<ReturnType<typeof requireOfficeActor>>;
 try{current=await requireOfficeActor()}
 catch(error){if(error instanceof OfficePermissionError)
  throw new OfficeConnectGovernanceError(error.status,error.message);throw error;}
 if(current.identity.workspaceStatus!=="ACTIVE")throw new OfficeConnectGovernanceError(403,"Active Office access is required");
 const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
 const [admin,auditor]=await Promise.all([
  resolveOfficePermission(current.admin,current.identity,"access.profile.assign",{type:"COMPANY"},device),
  resolveOfficePermission(current.admin,current.identity,"access.audit.read",{type:"COMPANY"},device),
 ]);
 if(!admin.allowed&&!auditor.allowed)throw new OfficeConnectGovernanceError(403,
  "Independent communication administration or audit capability is required");
 const [channels,assignments]=await Promise.all([
  current.admin.from("office_chat_conversations")
   .select("id,title,classification,state,department_code,updated_at")
   .eq("kind","DEPARTMENT").order("department_code").limit(1000),
  current.admin.from("office_job_assignments")
   .select("department_code,user_id").eq("status","ACTIVE").limit(5000),
 ]);
 if(channels.error||assignments.error)
  throw new OfficeConnectGovernanceError(503,"Channel metadata authority temporarily unavailable");
 const counts=new Map<string,Set<string>>();
 for(const row of assignments.data??[]){
  const code=String(row.department_code??"").trim().toUpperCase();
  if(!code)continue;
  const group=counts.get(code)??new Set<string>();
  group.add(String(row.user_id));counts.set(code,group);
 }
 const codes=new Set([...counts.keys(),...(channels.data??[])
  .map(row=>String(row.department_code??"").toUpperCase())]);
 const existing=new Map((channels.data??[])
  .map(row=>[String(row.department_code??"").toUpperCase(),row]));
 const truncated=(assignments.data??[]).length===5000;
 return {scope:"GOVERNED_CHANNEL_METADATA" as const,generated_at:new Date().toISOString(),
  assignments_complete:!truncated,
  departments:[...codes].filter(Boolean).sort().map(code=>{
   const channel=existing.get(code);
   return {department_code:code,
    channel_created:Boolean(channel),
    channel_id:channel?.id??null,
    classification:channel?.classification??null,
    state:channel?.state??"NOT_PROVISIONED",
    active_assignment_count:truncated?null:counts.get(code)?.size??0,
    updated_at:channel?.updated_at??null,
   };
  }),
  disclaimer:"Read-only governance inventory. A department's existence never grants you message or membership access. Channel creation and classification changes must follow the canonical change request and independent review; no action is executed here.",
 };
}
