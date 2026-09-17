import "server-only";

import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";

export class OfficeNotificationError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeNotificationError";
  }
}

async function actor() {
  try {
    return await requireOfficeActor();
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeNotificationError(error.status, error.message);
    throw error;
  }
}

export async function getOfficeNotificationCenter() {
  const { admin, identity } = await actor();
  const { data, error } = await admin
    .from("office_notifications")
    .select("id,request_id,kind,title,body,status,created_at,read_at")
    .eq("user_id", identity.userId)
    .neq("status", "DISMISSED")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new OfficeNotificationError(503, "Unable to load notifications");
  const notifications = data ?? [];
  return {
    unread: notifications.filter((item) => item.status === "UNREAD").length,
    notifications,
  };
}

export async function updateOfficeNotification(input: { notificationId: string; action: "READ" | "UNREAD" | "DISMISS" }) {
  const { admin, identity } = await actor();
  const { data, error } = await admin.rpc("office_update_notification_state", {
    p_actor: identity.userId,
    p_notification: input.notificationId,
    p_action: input.action,
  });
  if (error || typeof data !== "string") throw new OfficeNotificationError(400, error?.message ?? "Unable to update notification");
  return { status: data };
}

export async function markAllOfficeNotificationsRead() {
  const { admin, identity } = await actor();
  const { data, error } = await admin.rpc("office_mark_all_notifications_read", { p_actor: identity.userId });
  if (error || typeof data !== "number") throw new OfficeNotificationError(400, error?.message ?? "Unable to mark notifications read");
  return { updated: data };
}
