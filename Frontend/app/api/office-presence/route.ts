import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  getMyWorkforceState,
  OfficeWorkforceError,
  setMyPresence,
} from "@/lib/office/workforce-presence-server";

const updateSchema = z.object({
  status: z.enum(["AVAILABLE", "FOCUS", "IN_MEETING", "OOO", "DND"]),
  note: z.string().trim().max(240).nullable().optional(),
  until: z.string().datetime({ offset: true }).nullable().optional(),
  work_mode: z.enum(["UNSPECIFIED", "OFFICE", "REMOTE", "BUSINESS_TRAVEL"]).nullable().optional(),
  client_event_id: z.string().uuid().optional(),
});

function failure(error: unknown, fallback: string) {
  const status = error instanceof OfficeWorkforceError ? error.status : 500;
  const detail = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    return NextResponse.json(await getMyWorkforceState(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, "Unable to load workforce state");
  }
}

export async function PATCH(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin presence update is not allowed" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid presence update" }, { status: 400 });

  try {
    const state = await setMyPresence({
      status: parsed.data.status,
      note: parsed.data.note,
      until: parsed.data.until,
      workMode: parsed.data.work_mode,
      clientEventId: parsed.data.client_event_id,
    });
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, "Unable to update presence");
  }
}
