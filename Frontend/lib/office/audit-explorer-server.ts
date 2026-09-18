import "server-only";

import { getOfficeActivityTimeline } from "@/lib/office/activity-server";
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

function toTime(value:unknown){
  const parsed=Date.parse(typeof value==="string"?value:"");
  return Number.isFinite(parsed)?parsed:0;
}

export async function getOfficeAuditExplorerOverview(){
  const current=await actor();
  const owner=current.identity.roles.includes("OWNER");
  const [auditDecision,accessDecision]=await Promise.all([
    resolveOfficePermission(current.admin,current.identity,"audit.read",{type:"COMPANY"}),
    resolveOfficePermission(current.admin,current.identity,"access.audit.read",{type:"COMPANY"}),
  ]);
  if(!owner&&!auditDecision.allowed&&!accessDecision.allowed)throw new OfficeAuditExplorerError(403,"Audit read authority is required");

  const [activity,accessEvents,registrationEvents,people]=await Promise.all([
    getOfficeActivityTimeline(250),
    current.admin.from("office_access_audit")
      .select("id,actor_user_id,actor_roles,target_user_id,target_email,action,role,department,reason,metadata,created_at")
      .order("created_at",{ascending:false}).limit(600),
    current.admin.from("office_registration_events")
      .select("id,actor_user_id,registration_id,event_type,previous_status,new_status,note,metadata,created_at")
      .order("created_at",{ascending:false}).limit(600),
    current.admin.from("office_identity_users")
      .select("user_id,display_name,job_title,primary_department,status").order("display_name"),
  ]);
  if(accessEvents.error)throw new OfficeAuditExplorerError(503,"Access audit evidence is temporarily unavailable");
  if(registrationEvents.error)throw new OfficeAuditExplorerError(503,"Registration audit evidence is temporarily unavailable");
  if(people.error)throw new OfficeAuditExplorerError(503,"Audit actor identities are temporarily unavailable");

  const events=[
    ...(activity.items??[]).map(item=>({
      id:"activity:"+item.id,
      actor_id:null,
      action:item.kind,
      entity_type:"ACTIVITY_"+item.area,
      entity_id:item.id,
      context:{title:item.title,detail:item.detail,href:item.href,area:item.area},
      previous_state:null,
      new_state:null,
      created_at:item.occurred_at,
    })),
    ...(accessEvents.data??[]).map(row=>({
      id:"access:"+String(row.id),
      actor_id:row.actor_user_id,
      action:row.action,
      entity_type:"ACCESS_CONTROL",
      entity_id:row.target_user_id??row.target_email??null,
      context:{actor_roles:row.actor_roles,role:row.role,department:row.department,reason:row.reason,metadata:row.metadata},
      previous_state:null,
      new_state:null,
      created_at:row.created_at,
    })),
    ...(registrationEvents.data??[]).map(row=>({
      id:"registration:"+String(row.id),
      actor_id:row.actor_user_id,
      action:row.event_type,
      entity_type:"REGISTRATION",
      entity_id:row.registration_id,
      context:{note:row.note,metadata:row.metadata},
      previous_state:row.previous_status?{status:row.previous_status}:null,
      new_state:row.new_status?{status:row.new_status}:null,
      created_at:row.created_at,
    })),
  ].filter(row=>toTime(row.created_at)>0)
   .sort((a,b)=>toTime(b.created_at)-toTime(a.created_at))
   .slice(0,1200);

  return {
    generated_at:new Date().toISOString(),
    actor:{user_id:current.identity.userId,roles:current.identity.roles},
    events,
    people:people.data??[],
    disclaimer:"The Office side of this explorer combines authorized domain activity, access-governance evidence and registration events without reading or granting access to the legacy FastAPI audit table. The separate runtime hash-chain covers the canonical FastAPI event stream; neither source is presented as a statutory audit opinion.",
  };
}
