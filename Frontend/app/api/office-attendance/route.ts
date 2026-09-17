import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  OfficeWorkforceError,
  recordAttendanceAction,
} from "@/lib/office/workforce-presence-server";

const schema = z.object({
  action: z.enum(["CHECK_IN", "BREAK_START", "BREAK_END", "CHECK_OUT"]),
  work_mode: z.enum(["OFFICE", "REMOTE", "BUSINESS_TRAVEL"]).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  time_zone: z.string().trim().min(1).max(80).optional(),
  client_event_id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin attendance update is not allowed" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid attendance action" }, { status: 400 });

  try {
    const state = await recordAttendanceAction({
      action: parsed.data.action,
      workMode: parsed.data.work_mode,
      note: parsed.data.note,
      timeZone: parsed.data.time_zone,
      clientEventId: parsed.data.client_event_id,
    });
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeWorkforceError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to record attendance";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
