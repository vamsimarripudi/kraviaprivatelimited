import "server-only";
import {defaultNotificationPreferences,type OfficeNotificationPreferences} from "@/lib/office/notification-types";

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
    .select("id,request_id,kind,title,body,status,created_at,read_at,source_kind,source_id,target_path,priority,event_key")
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

export async function getOfficeNotificationPreferences() {
  const {admin,identity}=await actor();
  const r=await admin.from("office_notification_preferences")
    .select("sound_enabled,volume,quiet_enabled,quiet_start,quiet_end,browser_enabled,categories")
    .eq("user_id",identity.userId).maybeSingle();
  if(r.error)throw new OfficeNotificationError(503,"Notification preferences unavailable");
  const data=r.data;
  return {
    ...defaultNotificationPreferences,
    sound_enabled:data?.sound_enabled===true,
    volume:Number(data?.volume??defaultNotificationPreferences.volume),
    quiet_enabled:data?.quiet_enabled===true,
    quiet_start:String(data?.quiet_start??defaultNotificationPreferences.quiet_start).slice(0,5),
    quiet_end:String(data?.quiet_end??defaultNotificationPreferences.quiet_end).slice(0,5),
    browser_enabled:data?.browser_enabled===true,
    categories:{...defaultNotificationPreferences.categories,
      ...(data?.categories&&typeof data.categories==="object"&&!Array.isArray(data.categories)
        ? data.categories as Record<string,boolean>: {})},
  };
}
export async function updateOfficeNotificationPreferences(pref:OfficeNotificationPreferences) {
  const {admin,identity}=await actor();
  const r=await admin.from("office_notification_preferences").upsert({
    user_id:identity.userId,...pref,updated_at:new Date().toISOString(),
  },{onConflict:"user_id"});
  if(r.error)throw new OfficeNotificationError(503,"Unable to save notification preferences");
  return {saved:true};
}
