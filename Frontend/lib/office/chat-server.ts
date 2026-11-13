import "server-only";

import { requireOfficeActor, OfficePermissionError } from "@/lib/office/permission-engine";

export class OfficeChatError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeChatError";
  }
}

type OfficeChatActor = Awaited<ReturnType<typeof requireOfficeActor>>;
async function actor(): Promise<OfficeChatActor> {
  try {
    const current = await requireOfficeActor();
    if (current.identity.workspaceStatus !== "ACTIVE") {
      throw new OfficeChatError(403, "Active Office workspace access is required");
    }
    return current;
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeChatError(error.status, error.message);
    throw error;
  }
}
const internalFailure = (message: string) => new OfficeChatError(503, message);

async function ownMembership(current: OfficeChatActor, id: string) {
  const { data, error } = await current.admin.from("office_chat_memberships")
    .select("conversation_id").eq("conversation_id", id)
    .eq("user_id", current.identity.userId).eq("status", "ACTIVE").maybeSingle();
  if (error) throw internalFailure("The communication service is unavailable");
  if (!data) throw new OfficeChatError(404, "Conversation not found");
  const conversation = await current.admin.from("office_chat_conversations")
    .select("id,kind,state,department_code").eq("id", id).eq("state", "ACTIVE").maybeSingle();
  if (conversation.error) throw internalFailure("The communication service is unavailable");
  if (!conversation.data) throw new OfficeChatError(404, "Conversation not found");
  if(conversation.data.kind==="DEPARTMENT"){
    const assignment=await current.admin.from("office_job_assignments")
     .select("user_id").eq("user_id",current.identity.userId)
     .eq("status","ACTIVE").eq("department_code",conversation.data.department_code).maybeSingle();
    if(assignment.error)throw internalFailure("Department authority is unavailable");
    if(!assignment.data)throw new OfficeChatError(404,"Conversation not found");
  }
  return conversation.data;
}

export async function listOfficeChatDirectory(search = "") {
  const current = await actor();
  // A communication directory discloses only approved public work identity fields,
  // not HR records, personal contact fields, compensation or access profiles.
  const q = search.trim().slice(0, 80);
  let query = current.admin.from("office_identity_users")
    .select("user_id,display_name,job_title,primary_department")
    .eq("status", "ACTIVE").neq("user_id", current.identity.userId)
    .order("display_name").limit(80);
  if (q) query = query.ilike("display_name", "%" + q.replaceAll("%", "").replaceAll("_", "") + "%");
  const { data, error } = await query;
  if (error) throw internalFailure("The employee directory is unavailable");
  return { employees: data ?? [] };
}

export async function listOfficeChatConversations() {
  const current = await actor();
  const members = await current.admin.from("office_chat_memberships")
    .select("conversation_id").eq("user_id", current.identity.userId).eq("status", "ACTIVE").limit(100);
  if (members.error) throw internalFailure("The communication service is unavailable");
  const ids = (members.data ?? []).map(row => String(row.conversation_id));
  if (!ids.length) return { actor_user_id: current.identity.userId, conversations: [] };
  const [conversations, participants] = await Promise.all([
    current.admin.from("office_chat_conversations").select("id,kind,title,state,department_code,updated_at")
      .in("id", ids).eq("state", "ACTIVE").order("updated_at", { ascending: false }).limit(100),
    current.admin.from("office_chat_memberships").select("conversation_id,user_id,status")
      .in("conversation_id", ids).eq("status", "ACTIVE").limit(300),
  ]);
  if (conversations.error || participants.error) throw internalFailure("The communication service is unavailable");
  const others = [...new Set((participants.data ?? [])
    .filter(row => row.user_id !== current.identity.userId).map(row => String(row.user_id)))];
  const personResult = others.length
    ? await current.admin.from("office_identity_users").select("user_id,display_name")
      .in("user_id", others).eq("status", "ACTIVE")
    : { data: [], error: null };
  if (personResult.error) throw internalFailure("The communication directory is unavailable");
  const names = new Map((personResult.data ?? []).map(row => [String(row.user_id), String(row.display_name ?? "Employee")]));
  const job=await current.admin.from("office_job_assignments").select("department_code")
    .eq("user_id",current.identity.userId).eq("status","ACTIVE").maybeSingle();
  if(job.error)throw internalFailure("Current department is unavailable");
  const assignedDepartment=job.data?.department_code??null;
  return {
    actor_user_id: current.identity.userId,
    conversations: (conversations.data ?? []).filter(row=>
      row.kind!=="DEPARTMENT"||Boolean(assignedDepartment&&assignedDepartment===row.department_code)
    ).map(row => {
      const membersOfConversation = (participants.data ?? []).filter(m => m.conversation_id === row.id);
      const namesOfOthers = membersOfConversation
        .filter(m => m.user_id !== current.identity.userId)
        .map(m => names.get(String(m.user_id)) ?? "Employee");
      return { id: row.id, kind: row.kind,
        title: row.kind === "DM" ? namesOfOthers.join(", ") || "Private conversation"
          : row.title ?? "Conversation",
        updated_at: row.updated_at };
    }),
  };
}

export async function startOfficeChatDm(recipientUserId: string) {
  const current = await actor();
  if (recipientUserId === current.identity.userId) throw new OfficeChatError(400, "Choose another employee");
  const { data, error } = await current.admin.rpc("office_chat_start_dm", {
    p_actor: current.identity.userId, p_recipient: recipientUserId,
  });
  if (error || typeof data !== "string") throw new OfficeChatError(400, "Unable to start a private conversation");
  return { conversation_id: data };
}

export async function getOfficeChatMessages(conversationId: string) {
  const current = await actor();
  await ownMembership(current, conversationId);
  const result = await current.admin.from("office_chat_messages")
    .select("id,sender_user_id,body,created_at,edited_at")
    .eq("conversation_id", conversationId).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(100);
  if (result.error) throw internalFailure("Message history is unavailable");
  const rows = [...(result.data ?? [])].reverse();
  const senderIds = [...new Set(rows.map(row => String(row.sender_user_id)))];
  const people = senderIds.length
    ? await current.admin.from("office_identity_users").select("user_id,display_name").in("user_id", senderIds)
    : { data: [], error: null };
  if (people.error) throw internalFailure("Message author context is unavailable");
  const names = new Map((people.data ?? []).map(row => [String(row.user_id), String(row.display_name ?? "Employee")]));
  return { actor_user_id: current.identity.userId,
    messages: rows.map(row => ({
      id: row.id, sender_user_id: row.sender_user_id,
      sender_name: names.get(String(row.sender_user_id)) ?? "Employee",
      body: row.body, created_at: row.created_at, edited_at: row.edited_at,
    })) };
}

export async function sendOfficeChatMessage(conversationId: string, body: string, nonce: string, mentions: readonly string[] = []) {
  const current = await actor();
  await ownMembership(current, conversationId);
  const result = await current.admin.rpc(mentions.length?"office_chat_send_with_mentions":"office_chat_send_message", {
    p_actor: current.identity.userId, p_conversation: conversationId,
    p_body: body, p_nonce: nonce,...(mentions.length?{p_mentions:[...mentions]}:{}),
  });
  if (result.error || typeof result.data !== "string") {
    throw new OfficeChatError(503, "The message was not confirmed. Retry safely using the same draft.");
  }
  return { message_id: result.data };
}

export async function markOfficeChatRead(conversationId: string) {
  const current = await actor();
  await ownMembership(current, conversationId);
  const { data, error } = await current.admin.rpc("office_chat_advance_read", {
    p_actor: current.identity.userId, p_conversation: conversationId,
  });
  if (error || data !== true) throw internalFailure("Read receipt could not be confirmed");
  return { updated: true };
}


export async function createOfficeChatGroup(title: string, members: readonly string[]) {
  const current = await actor();
  const result = await current.admin.rpc("office_chat_create_group", {
    p_actor: current.identity.userId,
    p_title: title.trim(),
    p_members: [...members],
  });
  if (result.error || typeof result.data !== "string") {
    throw new OfficeChatError(400, "Could not create an authorized private group");
  }
  return { conversation_id: result.data };
}
export async function addOfficeChatGroupMember(conversationId: string, memberUserId: string) {
  const current = await actor();
  await ownMembership(current, conversationId);
  const result = await current.admin.rpc("office_chat_add_group_member", {
    p_actor: current.identity.userId,p_conversation:conversationId,p_member:memberUserId,
  });
  if (result.error || result.data !== true) throw new OfficeChatError(403, "Group membership change not authorized");
  return { added: true };
}


// Every indexed read is restricted to active conversation memberships before
// message text, names or pointers are fetched. A saved pointer never grants
// continuing visibility after role or membership revocation.
async function myConversationIds(current:OfficeChatActor){
 const {data,error}=await current.admin.from("office_chat_memberships")
  .select("conversation_id").eq("user_id",current.identity.userId).eq("status","ACTIVE").limit(300);
 if(error)throw internalFailure("Conversation membership authority is unavailable");
 const ids=(data??[]).map(row=>String(row.conversation_id));
 if(!ids.length)return [];
 const conversations=await current.admin.from("office_chat_conversations")
  .select("id,kind,department_code").in("id",ids).eq("state","ACTIVE");
 if(conversations.error)throw internalFailure("Conversation membership authority is unavailable");
 return (conversations.data??[]).map(row=>String(row.id));
}
async function enriched(current:OfficeChatActor,raw:Array<{
 id:string;conversation_id:string;sender_user_id:string;body:string;created_at:string;parent_message_id?:string|null;
}>){
 const names=[...new Set(raw.map(row=>String(row.sender_user_id)))];
 const people=names.length?await current.admin.from("office_identity_users")
  .select("user_id,display_name").in("user_id",names):{data:[],error:null};
 if(people.error)throw internalFailure("Message authors unavailable");
 const lookup=new Map((people.data??[]).map(row=>[String(row.user_id),String(row.display_name??"Employee")]));
 return raw.map(row=>({...row,sender_name:lookup.get(row.sender_user_id)??"Employee"}));
}
export async function searchOfficeChatMessages(query:string){
 const current=await actor();
 const ids=await myConversationIds(current);
 const q=query.trim().slice(0,100).replaceAll("%","").replaceAll("_","");
 if(!q||!ids.length)return {messages:[]};
 const result=await current.admin.from("office_chat_messages")
  .select("id,conversation_id,sender_user_id,body,created_at,parent_message_id")
  .in("conversation_id",ids).is("deleted_at",null)
  .ilike("body","%"+q+"%").order("created_at",{ascending:false}).limit(75);
 if(result.error)throw internalFailure("Private search is unavailable");
 return {messages:await enriched(current,result.data??[])};
}
export async function listOfficeChatSavedMessages(){
 const current=await actor();
 const ids=await myConversationIds(current);
 if(!ids.length)return {messages:[]};
 const saved=await current.admin.from("office_chat_saved_messages").select("message_id,saved_at")
  .eq("user_id",current.identity.userId).order("saved_at",{ascending:false}).limit(100);
 if(saved.error)throw internalFailure("Saved references unavailable");
 const messageIds=(saved.data??[]).map(row=>String(row.message_id));
 if(!messageIds.length)return {messages:[]};
 const result=await current.admin.from("office_chat_messages")
  .select("id,conversation_id,sender_user_id,body,created_at,parent_message_id")
  .in("id",messageIds).in("conversation_id",ids).is("deleted_at",null).limit(100);
 if(result.error)throw internalFailure("Saved messages unavailable");
 const order=new Map((saved.data??[]).map((row,index)=>[String(row.message_id),index]));
 return {messages:(await enriched(current,result.data??[])).sort((a,b)=>
   (order.get(a.id)??1000)-(order.get(b.id)??1000))};
}
export async function listOfficeChatMentions(){
 const current=await actor();
 const ids=await myConversationIds(current);
 if(!ids.length)return {messages:[]};
 const refs=await current.admin.from("office_chat_message_mentions")
  .select("message_id,read_at,created_at").eq("mentioned_user_id",current.identity.userId)
  .order("created_at",{ascending:false}).limit(100);
 if(refs.error)throw internalFailure("Mentions unavailable");
 const messageIds=(refs.data??[]).map(row=>String(row.message_id));
 if(!messageIds.length)return {messages:[]};
 const result=await current.admin.from("office_chat_messages")
  .select("id,conversation_id,sender_user_id,body,created_at,parent_message_id")
  .in("id",messageIds).in("conversation_id",ids).is("deleted_at",null).limit(100);
 if(result.error)throw internalFailure("Mentions unavailable");
 const index=new Map((refs.data??[]).map((row,i)=>[String(row.message_id),{index:i,read_at:row.read_at}]));
 return {messages:(await enriched(current,result.data??[])).map(row=>({
  ...row,read_at:index.get(row.id)?.read_at??null
 })).sort((a,b)=>(index.get(a.id)?.index??1000)-(index.get(b.id)?.index??1000))};
}
export async function getOfficeChatThread(parentId:string){
 const current=await actor();
 const parent=await current.admin.from("office_chat_messages")
  .select("id,conversation_id,sender_user_id,body,created_at,parent_message_id")
  .eq("id",parentId).is("deleted_at",null).maybeSingle();
 if(parent.error)throw internalFailure("Thread unavailable");
 if(!parent.data)throw new OfficeChatError(404,"Thread unavailable");
 await ownMembership(current,String(parent.data.conversation_id));
 const replies=await current.admin.from("office_chat_messages")
  .select("id,conversation_id,sender_user_id,body,created_at,parent_message_id")
  .eq("parent_message_id",parentId).is("deleted_at",null).order("created_at").limit(100);
 if(replies.error)throw internalFailure("Thread unavailable");
 return {conversation_id:String(parent.data.conversation_id),
  messages:await enriched(current,[parent.data,...(replies.data??[])])};
}
export async function sendOfficeChatReply(parentId:string,body:string,nonce:string){
 const current=await actor();
 const parent=await current.admin.from("office_chat_messages").select("conversation_id")
  .eq("id",parentId).is("deleted_at",null).maybeSingle();
 if(parent.error)throw internalFailure("Thread unavailable");
 if(!parent.data)throw new OfficeChatError(404,"Thread unavailable");
 await ownMembership(current,String(parent.data.conversation_id));
 const result=await current.admin.rpc("office_chat_send_reply",{p_actor:current.identity.userId,
  p_parent:parentId,p_nonce:nonce,p_body:body});
 if(result.error||typeof result.data!=="string")throw new OfficeChatError(409,"Thread reply not confirmed; retain the same nonce");
 return {message_id:result.data};
}
export async function saveOfficeChatMessage(messageId:string,save:boolean){
 const current=await actor();
 const parent=await current.admin.from("office_chat_messages").select("conversation_id")
  .eq("id",messageId).is("deleted_at",null).maybeSingle();
 if(parent.error)throw internalFailure("Message unavailable");
 if(!parent.data)throw new OfficeChatError(404,"Message unavailable");
 await ownMembership(current,String(parent.data.conversation_id));
 const result=await current.admin.rpc("office_chat_save_message",{
  p_actor:current.identity.userId,p_message:messageId,p_save:save});
 if(result.error||result.data!==true)throw new OfficeChatError(409,"Save state was not confirmed");
 return {saved:save};
}
export async function editOfficeChatMessage(messageId:string,body:string){
 const current=await actor();
 const result=await current.admin.rpc("office_chat_edit_message",{
  p_actor:current.identity.userId,p_message:messageId,p_body:body});
 if(result.error||result.data!==true)throw new OfficeChatError(409,"Message revision was not committed");
 return {edited:true};
}
export async function deleteOfficeChatMessage(messageId:string){
 const current=await actor();
 const result=await current.admin.rpc("office_chat_soft_delete_message",{
  p_actor:current.identity.userId,p_message:messageId});
 if(result.error||result.data!==true)throw new OfficeChatError(409,"Message removal was not confirmed");
 return {deleted:true};
}
export async function markOfficeChatMentionRead(messageId:string){
 const current=await actor();
 const result=await current.admin.rpc("office_chat_mark_mention_read",{
  p_actor:current.identity.userId,p_message:messageId});
 if(result.error||result.data!==true)throw new OfficeChatError(409,"Mention read state not confirmed");
 return {read:true};
}


export async function getOfficeChatMembers(conversationId:string){
 const current=await actor();
 await ownMembership(current,conversationId);
 const {data:members,error}=await current.admin.from("office_chat_memberships")
  .select("user_id").eq("conversation_id",conversationId).eq("status","ACTIVE").limit(100);
 if(error)throw internalFailure("Current conversation members unavailable");
 const ids=(members??[]).map(row=>String(row.user_id));
 if(!ids.length)return {members:[]};
 const people=await current.admin.from("office_identity_users")
  .select("user_id,display_name").in("user_id",ids).eq("status","ACTIVE").limit(100);
 if(people.error)throw internalFailure("Current conversation members unavailable");
 const conversation=await ownMembership(current,conversationId);
 if(conversation.kind!=="DEPARTMENT")return {members:people.data??[]};
 const assignments=await current.admin.from("office_job_assignments")
  .select("user_id").in("user_id",ids).eq("department_code",conversation.department_code)
  .eq("status","ACTIVE").limit(100);
 if(assignments.error)throw internalFailure("Department membership unavailable");
 const effective=new Set((assignments.data??[]).map(row=>String(row.user_id)));
 return {members:(people.data??[]).filter(row=>effective.has(String(row.user_id)))};
}


export async function getOfficeDepartmentChannel(code:string){
 const current=await actor();
 const normalized=code.trim().toUpperCase();
 if(current.identity.department!==normalized)
  throw new OfficeChatError(404,"Department channel unavailable");
 const job=await current.admin.from("office_job_assignments").select("department_code")
  .eq("user_id",current.identity.userId).eq("department_code",normalized)
  .eq("status","ACTIVE").maybeSingle();
 if(job.error)throw internalFailure("Department authority unavailable");
 if(!job.data)throw new OfficeChatError(404,"Department channel unavailable");
 const result=await current.admin.from("office_chat_conversations")
  .select("id,title").eq("kind","DEPARTMENT").eq("department_code",normalized)
  .eq("state","ACTIVE").maybeSingle();
 if(result.error)throw internalFailure("Department channel unavailable");
 if(!result.data)return {department:normalized,conversation_id:null,joined:false};
 const member=await current.admin.from("office_chat_memberships")
  .select("conversation_id").eq("conversation_id",result.data.id)
  .eq("user_id",current.identity.userId).eq("status","ACTIVE").maybeSingle();
 if(member.error)throw internalFailure("Department channel unavailable");
 return {department:normalized,conversation_id:result.data.id,joined:Boolean(member.data)};
}
export async function openOfficeDepartmentChannel(code:string){
 const current=await actor();
 const normalized=code.trim().toUpperCase();
 if(current.identity.department!==normalized)
   throw new OfficeChatError(404,"Department unavailable");
 const result=await current.admin.rpc("office_chat_open_department",{
  p_actor:current.identity.userId,p_department:normalized});
 if(result.error||typeof result.data!=="string")
  throw new OfficeChatError(403,"Current department assignment is required");
 return {conversation_id:result.data};
}
