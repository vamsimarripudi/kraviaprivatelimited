import "server-only";

import {createOfficeServiceClient,requireOfficeActor} from "@/lib/office/permission-engine";
import type {OfficeNotificationPriority} from "@/lib/office/notification-types";

type Admin = ReturnType<typeof createOfficeServiceClient>;
export type OfficeDelivery = {
  eventKey: string;
  kind: string;
  sourceId: string;
  targetPath: string;
  recipients: Array<string | null | undefined>;
  priority?: OfficeNotificationPriority;
  title: string;
  body: string;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safePath = /^\/(?:office|finance)\/[a-z0-9/_?=&%.-]{1,240}$/i;

/** Server-only delivery. Never accept recipients, paths or content from a browser.
 * A source workflow commits first, then this best-effort notification writer runs.
 * Failure never changes the source transaction or grants access to the record.
 */
export async function dispatchOfficeNotice(admin: Admin, event: OfficeDelivery) {
  // Explicit first-party actor check in this service-authority write layer,
  // in addition to the authorization performed by the source workflow.
  const current=await requireOfficeActor();
  if(current.identity.workspaceStatus!=="ACTIVE")return;
  if(!uuid.test(event.sourceId) || !safePath.test(event.targetPath)
    || !/^[a-z0-9:._-]{8,190}$/i.test(event.eventKey))return;
  const ids=[...new Set(event.recipients.filter((s):s is string=>
    typeof s==="string" && uuid.test(s)))].slice(0,100);
  if(!ids.length)return;
  const {data:users,error}=await admin.from("office_identity_users")
    .select("user_id").in("user_id",ids).eq("status","ACTIVE");
  if(error)return;
  for(const row of users??[]){
    const {error:writeError}=await admin.from("office_notifications").insert({
      user_id:row.user_id,
      event_key:event.eventKey,
      kind:event.kind,
      source_kind:event.kind,
      source_id:event.sourceId,
      title:event.title.slice(0,140),
      body:event.body.slice(0,300),
      target_path:event.targetPath,
      priority:event.priority??"NORMAL",
      status:"UNREAD",
    });
    // 23505 is an idempotent retry of a committed source event.
    if(writeError&&writeError.code!=="23505") {
      // Notification delivery does not change the success of source operations.
      console.error("Office notification delivery unavailable",writeError.code);
    }
  }
}

export async function dispatchOfficeChatMessage(
 admin:Admin,conversationId:string,messageId:string,senderId:string,mentions:readonly string[]
) {
  if(!uuid.test(conversationId)||!uuid.test(messageId))return;
  const [conversation,members]=await Promise.all([
    admin.from("office_chat_conversations")
      .select("kind,department_code").eq("id",conversationId).eq("state","ACTIVE").maybeSingle(),
    admin.from("office_chat_memberships")
      .select("user_id").eq("conversation_id",conversationId).eq("status","ACTIVE").limit(150),
  ]);
  if(conversation.error||members.error||!conversation.data)return;
  const kind=conversation.data.kind;
  let ids=(members.data??[]).map(row=>String(row.user_id)).filter(id=>id!==senderId);
  if(kind==="DEPARTMENT"){
    const jobs=await admin.from("office_job_assignments").select("user_id")
      .eq("department_code",conversation.data.department_code).eq("status","ACTIVE");
    if(jobs.error)return;
    const membersInDepartment=new Set((jobs.data??[]).map(j=>String(j.user_id)));
    ids=ids.filter(id=>membersInDepartment.has(id));
  }
  const route=kind==="DM" ? "/office/chat/dm/"+conversationId :
    kind==="GROUP" ? "/office/chat/groups/"+conversationId :
    conversation.data.department_code && /^[a-z0-9_-]{2,40}$/i.test(conversation.data.department_code)
      ? "/office/chat/channels/"+conversation.data.department_code.toLowerCase() : "/office/chat";
  const mentioned=new Set(mentions);
  for(const id of ids){
    const isMention=mentioned.has(id);
    await dispatchOfficeNotice(admin,{
      eventKey:"chat:"+messageId,kind:isMention?"CHAT_MENTION":"CHAT_MESSAGE",
      sourceId:conversationId,targetPath:route,recipients:[id],
      priority:isMention?"HIGH":"NORMAL",
      title:isMention?"You were mentioned in Connect":"New Connect message",
      body:"Open KRAVIA Connect to read the private message.",
    });
  }
}

export async function dispatchOfficeWorkNotice(admin:Admin,requestId:string,actorId:string,event:string) {
  if(!uuid.test(requestId))return;
  const r=await admin.from("office_requests")
    .select("id,requester_user_id,target_user_id,priority").eq("id",requestId).maybeSingle();
  if(r.error||!r.data)return;
  const steps=await admin.from("office_request_steps")
    .select("id,assigned_user_id,status").eq("request_id",requestId).eq("status","PENDING").limit(60);
  const assigned=(steps.data??[]).filter(s=>s.assigned_user_id&&s.assigned_user_id!==actorId);
  for(const step of assigned){
    await dispatchOfficeNotice(admin,{
      eventKey:"approval:"+step.id,kind:"APPROVAL_REQUIRED",
      sourceId:requestId,targetPath:"/office/approvals",
      recipients:[step.assigned_user_id],priority:"HIGH",
      title:"Approval requires review",
      body:"A company workflow approval is assigned to you.",
    });
  }
  await dispatchOfficeNotice(admin,{
    eventKey:"request:"+requestId+":"+event.toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,22),
    kind:"DEPARTMENT_REQUEST",sourceId:requestId,targetPath:"/office/requests",
    recipients:[r.data.requester_user_id,r.data.target_user_id].filter(u=>u!==actorId),
    priority:r.data.priority==="URGENT"?"CRITICAL":r.data.priority==="HIGH"?"HIGH":"NORMAL",
    title:"Department request update",body:"A company request has changed. Review its current status in Office.",
  });
}

export async function dispatchOfficeITNotice(admin:Admin,ticketId:string,actorId:string,event:string) {
  if(!uuid.test(ticketId))return;
  const r=await admin.from("office_it_service_tickets")
    .select("id,requester_user_id,owner_user_id,priority").eq("id",ticketId).maybeSingle();
  if(r.error||!r.data)return;
  await dispatchOfficeNotice(admin,{
    eventKey:"it:"+ticketId+":"+event.toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,30),
    kind:"IT_TICKET",sourceId:ticketId,targetPath:"/office/it",
    recipients:[r.data.requester_user_id,r.data.owner_user_id].filter(u=>u!==actorId),
    priority:r.data.priority==="URGENT"?"CRITICAL":r.data.priority==="HIGH"?"HIGH":"NORMAL",
    title:"IT service ticket updated",body:"A company IT request assigned to you has changed.",
  });
}

export async function dispatchOfficeSupportNotice(admin:Admin,caseId:string,actorId:string,event:string) {
  if(!uuid.test(caseId))return;
  const r=await admin.from("office_support_cases")
    .select("id,created_by,owner_user_id,priority").eq("id",caseId).maybeSingle();
  if(r.error||!r.data)return;
  await dispatchOfficeNotice(admin,{
    eventKey:"support:"+caseId+":"+event.toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,30),
    kind:"SUPPORT_CASE",sourceId:caseId,targetPath:"/office/support",
    recipients:[r.data.created_by,r.data.owner_user_id].filter(u=>u!==actorId),
    priority:r.data.priority==="URGENT"?"CRITICAL":r.data.priority==="HIGH"?"HIGH":"NORMAL",
    title:"Support case updated",body:"An assigned customer support case requires your attention.",
  });
}
