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
    .select("id,kind,state").eq("id", id).eq("state", "ACTIVE").maybeSingle();
  if (conversation.error) throw internalFailure("The communication service is unavailable");
  if (!conversation.data) throw new OfficeChatError(404, "Conversation not found");
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
    current.admin.from("office_chat_conversations").select("id,kind,title,state,updated_at")
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
  return {
    actor_user_id: current.identity.userId,
    conversations: (conversations.data ?? []).map(row => {
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

export async function sendOfficeChatMessage(conversationId: string, body: string, nonce: string) {
  const current = await actor();
  await ownMembership(current, conversationId);
  const result = await current.admin.rpc("office_chat_send_message", {
    p_actor: current.identity.userId, p_conversation: conversationId,
    p_body: body, p_nonce: nonce,
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
