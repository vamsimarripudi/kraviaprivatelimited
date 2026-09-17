import "server-only";

import { randomUUID } from "node:crypto";
import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";
import {
  attendanceState,
  effectiveAvailability,
  trackedAttendanceSeconds,
  type OfficeAttendanceState,
  type OfficeAvailabilityStatus,
  type OfficeEmploymentStatus,
  type OfficeWorkMode,
} from "@/lib/office/workforce-presence";

export class OfficeWorkforceError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeWorkforceError";
  }
}

type PresenceRow = {
  user_id: string;
  availability_status: OfficeAvailabilityStatus;
  work_mode: OfficeWorkMode;
  status_note?: string | null;
  status_until?: string | null;
  last_interaction_at?: string | null;
  updated_at: string;
};

type WorkStatusRow = {
  status: OfficeEmploymentStatus;
  effective_from: string;
  effective_to?: string | null;
  source: string;
  reason?: string | null;
};

type AttendanceSessionRow = {
  id: string;
  user_id: string;
  work_date: string;
  time_zone: string;
  work_mode: Exclude<OfficeWorkMode, "UNSPECIFIED">;
  check_in_at: string;
  check_out_at?: string | null;
  status: "OPEN" | "CLOSED";
  source: string;
  note?: string | null;
  closing_reason?: string | null;
};

type AttendanceBreakRow = {
  id: string;
  attendance_session_id: string;
  break_kind: string;
  started_at: string;
  ended_at?: string | null;
  note?: string | null;
};

async function workforceActor() {
  try {
    return await requireOfficeActor();
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeWorkforceError(error.status, error.message);
    throw error;
  }
}

function throwIf(error: { message?: string } | null, message: string) {
  if (error) throw new OfficeWorkforceError(500, `${message}: ${error.message ?? "unknown data authority error"}`);
}

function mutationError(message: string) {
  const conflict = /already open|no open|active break|check in before|no active break/i.test(message);
  const invalid = /invalid|required|too long|future/i.test(message);
  return new OfficeWorkforceError(conflict ? 409 : invalid ? 400 : 500, message);
}

export type OfficeWorkforceState = {
  server_time: string;
  presence: PresenceRow & { effective_status: OfficeAvailabilityStatus };
  employment_status: WorkStatusRow;
  attendance: {
    state: OfficeAttendanceState;
    current_session: AttendanceSessionRow | null;
    current_break: AttendanceBreakRow | null;
    tracked_seconds: number;
    recent_sessions: AttendanceSessionRow[];
  };
};

export async function getMyWorkforceState(): Promise<OfficeWorkforceState> {
  const { admin, identity } = await workforceActor();
  const now = new Date();
  const nowIso = now.toISOString();

  const [presenceResult, workStatusResult, openSessionResult, recentSessionsResult] = await Promise.all([
    admin.from("office_presence_state")
      .select("user_id,availability_status,work_mode,status_note,status_until,last_interaction_at,updated_at")
      .eq("user_id", identity.userId)
      .maybeSingle(),
    admin.from("office_work_status_assignments")
      .select("status,effective_from,effective_to,source,reason")
      .eq("user_id", identity.userId)
      .lte("effective_from", nowIso)
      .or(`effective_to.is.null,effective_to.gt.${nowIso}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("office_attendance_sessions")
      .select("id,user_id,work_date,time_zone,work_mode,check_in_at,check_out_at,status,source,note,closing_reason")
      .eq("user_id", identity.userId)
      .eq("status", "OPEN")
      .maybeSingle(),
    admin.from("office_attendance_sessions")
      .select("id,user_id,work_date,time_zone,work_mode,check_in_at,check_out_at,status,source,note,closing_reason")
      .eq("user_id", identity.userId)
      .order("check_in_at", { ascending: false })
      .limit(8),
  ]);

  throwIf(presenceResult.error, "Unable to read presence");
  throwIf(workStatusResult.error, "Unable to read workforce status");
  throwIf(openSessionResult.error, "Unable to read attendance session");
  throwIf(recentSessionsResult.error, "Unable to read attendance history");

  const currentSession = (openSessionResult.data ?? null) as AttendanceSessionRow | null;
  const breaksResult = currentSession
    ? await admin.from("office_attendance_breaks")
      .select("id,attendance_session_id,break_kind,started_at,ended_at,note")
      .eq("attendance_session_id", currentSession.id)
      .order("started_at", { ascending: true })
    : { data: [], error: null };
  throwIf(breaksResult.error, "Unable to read attendance breaks");

  const breaks = (breaksResult.data ?? []) as AttendanceBreakRow[];
  const currentBreak = breaks.find((item) => !item.ended_at) ?? null;
  const rawPresence = presenceResult.data as PresenceRow | null;
  const effective = effectiveAvailability(rawPresence, now.getTime());
  const presence: PresenceRow & { effective_status: OfficeAvailabilityStatus } = rawPresence
    ? { ...rawPresence, effective_status: effective.availability_status }
    : {
      user_id: identity.userId,
      availability_status: "AVAILABLE",
      effective_status: "AVAILABLE",
      work_mode: "UNSPECIFIED",
      status_note: null,
      status_until: null,
      last_interaction_at: null,
      updated_at: nowIso,
    };

  const employmentStatus = (workStatusResult.data as WorkStatusRow | null) ?? {
    status: "WORKING",
    effective_from: nowIso,
    effective_to: null,
    source: "SYSTEM",
    reason: null,
  };

  return {
    server_time: nowIso,
    presence,
    employment_status: employmentStatus,
    attendance: {
      state: attendanceState(Boolean(currentSession), Boolean(currentBreak)),
      current_session: currentSession,
      current_break: currentBreak,
      tracked_seconds: trackedAttendanceSeconds(currentSession, breaks, now.getTime()),
      recent_sessions: (recentSessionsResult.data ?? []) as AttendanceSessionRow[],
    },
  };
}

export async function setMyPresence(input: {
  status: OfficeAvailabilityStatus;
  note?: string | null;
  until?: string | null;
  workMode?: OfficeWorkMode | null;
  clientEventId?: string;
}) {
  const { admin, identity } = await workforceActor();
  const { error } = await admin.rpc("office_set_presence", {
    p_actor: identity.userId,
    p_status: input.status,
    p_note: input.note?.trim() || null,
    p_until: input.until ?? null,
    p_work_mode: input.workMode ?? null,
    p_client_event_id: input.clientEventId ?? randomUUID(),
  });
  if (error) throw mutationError(error.message || "Unable to update presence");
  return getMyWorkforceState();
}

export async function recordAttendanceAction(input: {
  action: "CHECK_IN" | "BREAK_START" | "BREAK_END" | "CHECK_OUT";
  workMode?: Exclude<OfficeWorkMode, "UNSPECIFIED"> | null;
  note?: string | null;
  timeZone?: string | null;
  clientEventId?: string;
}) {
  const { admin, identity } = await workforceActor();
  const { error } = await admin.rpc("office_attendance_act", {
    p_actor: identity.userId,
    p_action: input.action,
    p_work_mode: input.workMode ?? null,
    p_note: input.note?.trim() || null,
    p_time_zone: input.timeZone || "Asia/Kolkata",
    p_client_event_id: input.clientEventId ?? randomUUID(),
  });
  if (error) throw mutationError(error.message || "Unable to record attendance");
  return getMyWorkforceState();
}
