import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOfficeActor, resolveOfficePermission, type OfficeResourceScope } from "@/lib/office/permission-engine";
import type { OfficeIdentity } from "@/lib/office/auth-server";

export class OfficeCollaborationError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeCollaborationError";
  }
}

type RequestRow = {
  id: string;
  requester_user_id: string;
  target_user_id?: string | null;
  title: string;
  status: string;
};

function fail(error: { message?: string } | null, message: string) {
  if (error) throw new OfficeCollaborationError(500, message);
}

async function requestForActor(admin: SupabaseClient, identity: OfficeIdentity, requestId: string): Promise<RequestRow> {
  const { data: request, error } = await admin
    .from("office_requests")
    .select("id,requester_user_id,target_user_id,title,status")
    .eq("id", requestId)
    .maybeSingle();
  fail(error, "Unable to read request");
  if (!request) throw new OfficeCollaborationError(404, "Request not found");

  if (identity.roles.includes("OWNER") || request.requester_user_id === identity.userId || request.target_user_id === identity.userId) {
    return request as RequestRow;
  }

  const [stepResult, managerResult] = await Promise.all([
    admin
      .from("office_request_steps")
      .select("id")
      .eq("request_id", requestId)
      .or(`assigned_user_id.eq.${identity.userId},decision_by.eq.${identity.userId}`)
      .limit(1),
    admin
      .from("office_job_assignments")
      .select("reports_to_user_id")
      .eq("user_id", request.requester_user_id)
      .maybeSingle(),
  ]);
  fail(stepResult.error, "Unable to verify request participation");
  fail(managerResult.error, "Unable to verify reporting authority");

  if ((stepResult.data ?? []).length || managerResult.data?.reports_to_user_id === identity.userId) return request as RequestRow;
  throw new OfficeCollaborationError(403, "This request is outside your participation scope");
}

async function activeIdentityIds(admin: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const { data, error } = await admin.from("office_identity_users").select("user_id,status").in("user_id", ids);
  fail(error, "Unable to resolve Office participants");
  return new Set((data ?? []).filter((row) => row.status === "ACTIVE").map((row) => row.user_id));
}

async function mentionedUserIds(admin: SupabaseClient, body: string) {
  const emails = Array.from(new Set(body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.map((value) => value.toLowerCase()) ?? []));
  if (!emails.length) return [] as string[];
  const { data: users, error } = await admin
    .from("office_auth_users")
    .select("id,email")
    .in("email", emails);
  fail(error, "Unable to resolve mentioned users");
  return (users ?? [])
    .filter((user) => typeof user.email === "string" && emails.includes(user.email.toLowerCase()))
    .map((user) => user.id);
}

export async function listRequestComments(requestId: string) {
  const { admin, identity } = await requireOfficeActor();
  await requestForActor(admin, identity, requestId);
  const { data: comments, error } = await admin
    .from("office_request_comments")
    .select("id,request_id,author_user_id,body,created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  fail(error, "Unable to read request comments");
  const authorIds = Array.from(new Set((comments ?? []).map((row) => row.author_user_id)));
  const { data: identities, error: identityError } = authorIds.length
    ? await admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department").in("user_id", authorIds)
    : { data: [], error: null };
  fail(identityError, "Unable to resolve comment authors");
  const authorMap = new Map((identities ?? []).map((row) => [row.user_id, row]));
  return {
    request_id: requestId,
    comments: (comments ?? []).map((row) => ({ ...row, author: authorMap.get(row.author_user_id) ?? null })),
  };
}

export async function addRequestComment(requestId: string, body: string) {
  const { admin, identity } = await requireOfficeActor();
  const request = await requestForActor(admin, identity, requestId);
  const scope: OfficeResourceScope = { type: "OWN", ownerUserId: identity.userId };
  const permission = await resolveOfficePermission(admin, identity, "request.comment", scope);
  if (!permission.allowed) throw new OfficeCollaborationError(403, permission.reason);

  const text = body.trim();
  if (!text || text.length > 4000) throw new OfficeCollaborationError(400, "Comment must contain 1 to 4000 characters");
  const { data: comment, error } = await admin
    .from("office_request_comments")
    .insert({ request_id: requestId, author_user_id: identity.userId, body: text })
    .select("id,request_id,author_user_id,body,created_at")
    .single();
  if (error || !comment) throw new OfficeCollaborationError(500, "Unable to add request comment");

  const { error: eventError } = await admin.from("office_request_events").insert({
    request_id: requestId,
    actor_user_id: identity.userId,
    event_type: "COMMENT_ADDED",
    from_status: request.status,
    to_status: request.status,
    note: "Request collaboration comment added",
    metadata: { comment_id: comment.id },
  });
  fail(eventError, "Unable to append collaboration event");

  const mentions = await mentionedUserIds(admin, text);
  const recipients = Array.from(new Set([request.requester_user_id, request.target_user_id, ...mentions].filter((value): value is string => Boolean(value && value !== identity.userId))));
  const activeRecipients = await activeIdentityIds(admin, recipients);
  if (activeRecipients.size) {
    const { error: notificationError } = await admin.from("office_notifications").insert(Array.from(activeRecipients).map((userId) => ({
      user_id: userId,
      request_id: requestId,
      kind: mentions.includes(userId) ? "REQUEST_MENTION" : "REQUEST_COMMENT",
      title: mentions.includes(userId) ? `Mentioned in: ${request.title}` : `New comment: ${request.title}`,
      body: text.length > 220 ? `${text.slice(0, 217)}...` : text,
      status: "UNREAD",
    })));
    fail(notificationError, "Unable to notify request participants");
  }
  return { comment };
}
