import "server-only";

import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";

export class OfficeAuditExplorerError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeAuditExplorerError"}
}
async function actor(){
 try{return await requireOfficeActor()}catch(error){
  if(error instanceof OfficePermissionError)throw new OfficeAuditExplorerError(error.status,error.message);
  throw error;
 }
}
export async function getOfficeAuditExplorerOverview(){
 const current=await actor();
 const owner=current.identity.roles.includes("OWNER");
 const [auditDecision,accessDecision]=await Promise.all([
  resolveOfficePermission(current.admin,current.identity,"audit.read",{type:"COMPANY"}),
  resolveOfficePermission(current.admin,current.identity,"access.audit.read",{type:"COMPANY"}),
 ]);
 if(!owner&&!auditDecision.allowed&&!accessDecision.allowed)throw new OfficeAuditExplorerError(403,"Audit read authority is required");
 const [events,people]=await Promise.all([
  current.admin.from("audit_events").select("id,actor_id,action,entity_type,entity_id,context,previous_state,new_state,created_at").order("created_at",{ascending:false}).limit(1000),
  current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").order("display_name"),
 ]);
 if(events.error)throw new OfficeAuditExplorerError(503,"Corporate audit events are temporarily unavailable");
 if(people.error)throw new OfficeAuditExplorerError(503,"Audit actor identities are temporarily unavailable");
 return {
  generated_at:new Date().toISOString(),
  actor:{user_id:current.identity.userId,roles:current.identity.roles},
  events:events.data??[],
  people:people.data??[],
  disclaimer:"Corporate audit events are append-oriented evidence from the Office control plane. The separate runtime hash-chain covers its own canonical event stream; neither source is presented as a statutory audit opinion.",
 };
}
