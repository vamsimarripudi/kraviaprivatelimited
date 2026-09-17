import { NextResponse } from "next/server";
import { z } from "zod";
import {
  cancelOfficeCalendarEvent,
  createOfficeCalendarEvent,
  getOfficeCompanyCalendar,
  OfficeCalendarError,
} from "@/lib/office/calendar-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const createSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().max(4000).optional(),
  event_type: z.enum(["MEETING","DEADLINE","LAUNCH","CUSTOMER","MAINTENANCE","REVIEW","REMINDER","OTHER"]),
  visibility: z.enum(["PERSONAL","COMPANY","DEPARTMENT","TEAM"]),
  scope_key: z.string().trim().max(120).optional(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }).optional(),
  all_day: z.boolean().optional(),
});
const cancelSchema = z.object({ event_id: z.string().uuid() });

export async function GET() {
  try {
    return NextResponse.json(await getOfficeCompanyCalendar(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeCalendarError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load company calendar";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin calendar mutation is not allowed" }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid calendar event" }, { status: 400 });
  try {
    const result = await createOfficeCalendarEvent({
      title: parsed.data.title,
      description: parsed.data.description,
      eventType: parsed.data.event_type,
      visibility: parsed.data.visibility,
      scopeKey: parsed.data.scope_key,
      startsAt: parsed.data.starts_at,
      endsAt: parsed.data.ends_at,
      allDay: parsed.data.all_day,
    });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeCalendarError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to create calendar event";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin calendar mutation is not allowed" }, { status: 403 });
  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid calendar event" }, { status: 400 });
  try {
    return NextResponse.json(await cancelOfficeCalendarEvent(parsed.data.event_id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeCalendarError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to cancel calendar event";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
