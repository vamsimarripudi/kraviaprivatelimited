import "server-only";
import {OfficePermissionError,requireOfficeActor,resolveOfficePermission} from "@/lib/office/permission-engine";
import {getOfficeItOverview} from "@/lib/office/it-service-server";
export class OfficeChatEscalationError extends Error{
 constructor(public readonly status:number,message:string){super(message);this.name="OfficeChatEscalationError";}
}
async function actor(){
 try{return await requireOfficeActor();}
 catch(e){if(e instanceof OfficePermissionError)throw new OfficeChatEscalationError(e.status,e.message);throw e;}
}
export async function listOfficeChatEscalations(){
 const current=await actor();
 const source=await getOfficeItOverview(); // Canonical view is already scoped to current actor.
 const visibleIds=source.tickets.map(row=>String(row.id));
 if(!visibleIds.length)return {items:[],events:[],can_manage:source.capabilities.manage,identities:source.identities??[]};
 const rows=await current.admin.from("office_chat_it_escalations")
   .select("id,ticket_id,level,recipient_user_id,created_by,reason,source_due_at,status,acknowledged_at,resolved_at,created_at")
   .in("ticket_id",visibleIds).order("created_at",{ascending:false}).limit(200);
 if(rows.error)throw new OfficeChatEscalationError(503,"Escalation authority unavailable");
 const ids=(rows.data??[]).map(row=>String(row.id));
 const events=ids.length?await current.admin.from("office_chat_it_escalation_events")
   .select("id,escalation_id,actor_user_id,event_type,note,occurred_at")
   .in("escalation_id",ids).order("occurred_at",{ascending:false}).limit(500):
   {data:[],error:null};
 if(events.error)throw new OfficeChatEscalationError(503,"Escalation audit unavailable");
 const tickets=new Map(source.tickets.map(t=>[String(t.id),t]));
 return {actor_user_id:current.identity.userId,can_manage:source.capabilities.manage,
  identities:source.identities??[],
  items:(rows.data??[]).map(row=>({...row,source_ticket:tickets.get(String(row.ticket_id))??null})),
  events:events.data??[]};
}
export async function createOfficeChatEscalation(input:{ticketId:string;recipientId:string;level:number;reason:string;nonce:string}){
 const current=await actor();
 const authority=await resolveOfficePermission(current.admin,current.identity,"it.service.manage",{type:"COMPANY"});
 if(!authority.allowed)throw new OfficeChatEscalationError(403,authority.reason);
 const {data,error}=await current.admin.rpc("office_chat_escalate_it",{
  p_actor:current.identity.userId,p_ticket:input.ticketId,p_recipient:input.recipientId,
  p_level:input.level,p_reason:input.reason,p_nonce:input.nonce,
 });
 if(error||typeof data!=="string")throw new OfficeChatEscalationError(409,error?.message||"Escalation not confirmed");
 return {escalation_id:data};
}
export async function actionOfficeChatEscalation(input:{id:string;action:"ACKNOWLEDGE"|"RESOLVE";note:string}){
 const current=await actor();
 const result=input.action==="ACKNOWLEDGE"
 ?await current.admin.rpc("office_chat_ack_it_escalation",{p_actor:current.identity.userId,
  p_escalation:input.id,p_note:input.note}):
  await current.admin.rpc("office_chat_resolve_it_escalation",{p_actor:current.identity.userId,
   p_escalation:input.id,p_note:input.note});
 if(result.error||result.data!==true)throw new OfficeChatEscalationError(409,result.error?.message||"Escalation action not confirmed");
 return {updated:true};
}
