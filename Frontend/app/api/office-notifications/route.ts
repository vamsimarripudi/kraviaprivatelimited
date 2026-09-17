import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getOfficeNotificationCenter,
  markAllOfficeNotificationsRead,
  OfficeNotificationError,
  updateOfficeNotification,
} from "@/lib/office/notification-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["READ", "UNREAD", "DISMISS"]), notification_id: z.string().uuid() }),
  z.object({ action: z.literal("READ_ALL") }),
]);

export async function GET() {
  try {
    return NextResponse.json(await getOfficeNotificationCenter(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeNotificationError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load notifications";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function PATCH(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin notification mutation is not allowed" }, { status: 403 });
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid notification action" }, { status: 400 });
  try {
    const result = parsed.data.action === "READ_ALL"
      ? await markAllOfficeNotificationsRead()
      : await updateOfficeNotification({ notificationId: parsed.data.notification_id, action: parsed.data.action });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeNotificationError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to update notifications";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
