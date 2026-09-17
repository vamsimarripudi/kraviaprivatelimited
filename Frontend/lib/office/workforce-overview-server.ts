import "server-only";

import { OfficePermissionError, requireOfficePermission } from "@/lib/office/permission-engine";
import { effectiveAvailability, type OfficeAvailabilityStatus, type OfficeEmploymentStatus, type OfficeWorkMode } from "@/lib/office/workforce-presence";

export class OfficeWorkforceOverviewError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeWorkforceOverviewError";
  }
}

type IdentityRow = { user_id: string; status: string; display_name: string | null; primary_department: string | null; job_title: string | null };
type PersonRegistryRow = { person_id: string; person_code: string; identity_user_id: string; lifecycle_status: string };
type EmploymentRegistryRow = { employment_id: string; employment_code: string; person_id: string; identity_user_id: string; relationship_type: string; status: string; start_date: string | null; end_date: string | null; created_at: string };
type JobRow = { user_id: string; position_code: string | null; department_code: string | null; reports_to_user_id: string | null; team_key: string | null; employment_type: string | null };
type PresenceRow = { user_id: string; availability_status: OfficeAvailabilityStatus; work_mode: OfficeWorkMode; status_note: string | null; status_until: string | null; last_interaction_at: string | null };
type WorkStatusRow = { user_id: string; status: OfficeEmploymentStatus; effective_from: string; effective_to: string | null; source: string; reason: string | null };
type AttendanceRow = { id: string; user_id: string; work_mode: Exclude<OfficeWorkMode, "UNSPECIFIED">; check_in_at: string; time_zone: string };
type AuthRow = { user_id: string; status: string; aal: string; mfa_verified: boolean; started_at: string; last_seen_at: string; risk_level: string };

function latestByUser<T extends { user_id: string }>(rows: T[], compare: (row: T) => string) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const current = map.get(row.user_id);
    if (!current || compare(row) > compare(current)) map.set(row.user_id, row);
  }
  return map;
}

function sessionPresence(row: AuthRow | undefined, now: number) {
  if (!row || row.status !== "ACTIVE") return "OFFLINE" as const;
  const seen = Date.parse(row.last_seen_at);
  if (!Number.isFinite(seen)) return "OFFLINE" as const;
  const age = Math.max(0, now - seen);
  if (age <= 3 * 60_000) return "ONLINE" as const;
  if (age <= 15 * 60_000) return "IDLE" as const;
  return "OFFLINE" as const;
}

export async function getOfficeWorkforceLiveOverview() {
  let actor;
  try {
    actor = await requireOfficePermission("people.basic.read", { type: "COMPANY" });
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeWorkforceOverviewError(error.status, error.message);
    throw error;
  }

  const { admin } = actor;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const [identitiesResult, peopleRegistryResult, employmentsResult, jobsResult, presenceResult, statusesResult, attendanceResult, authResult] = await Promise.all([
    admin.from("office_identity_users").select("user_id,status,display_name,primary_department,job_title").eq("status", "ACTIVE").order("display_name"),
    admin.from("office_people_registry").select("person_id,person_code,identity_user_id,lifecycle_status"),
    admin.from("office_employment_registry").select("employment_id,employment_code,person_id,identity_user_id,relationship_type,status,start_date,end_date,created_at").order("created_at", { ascending: false }),
    admin.from("office_job_assignments").select("user_id,position_code,department_code,reports_to_user_id,team_key,employment_type").eq("status", "ACTIVE"),
    admin.from("office_presence_state").select("user_id,availability_status,work_mode,status_note,status_until,last_interaction_at"),
    admin.from("office_work_status_assignments").select("user_id,status,effective_from,effective_to,source,reason").lte("effective_from", nowIso).or(`effective_to.is.null,effective_to.gt.${nowIso}`).order("effective_from", { ascending: false }),
    admin.from("office_attendance_sessions").select("id,user_id,work_mode,check_in_at,time_zone").eq("status", "OPEN"),
    admin.from("office_auth_sessions").select("user_id,status,aal,mfa_verified,started_at,last_seen_at,risk_level").eq("status", "ACTIVE").order("last_seen_at", { ascending: false }),
  ]);

  const failed = [identitiesResult, peopleRegistryResult, employmentsResult, jobsResult, presenceResult, statusesResult, attendanceResult, authResult].find((result) => result.error);
  if (failed?.error) throw new OfficeWorkforceOverviewError(503, "Workforce authority is temporarily unavailable");

  const identities = (identitiesResult.data ?? []) as IdentityRow[];
  const peopleRegistry = new Map(((peopleRegistryResult.data ?? []) as PersonRegistryRow[]).map((row) => [row.identity_user_id, row]));
  const employments = latestByUser((employmentsResult.data ?? []) as EmploymentRegistryRow[], (row) => `${["ACTIVE", "ON_LEAVE", "PLANNED"].includes(row.status) ? "1" : "0"}:${row.created_at}`);
  const jobs = latestByUser((jobsResult.data ?? []) as JobRow[], () => "1");
  const presence = new Map(((presenceResult.data ?? []) as PresenceRow[]).map((row) => [row.user_id, row]));
  const statuses = latestByUser((statusesResult.data ?? []) as WorkStatusRow[], (row) => row.effective_from);
  const attendanceRows = (attendanceResult.data ?? []) as AttendanceRow[];
  const attendance = new Map(attendanceRows.map((row) => [row.user_id, row]));
  const auth = latestByUser((authResult.data ?? []) as AuthRow[], (row) => row.last_seen_at);

  const openAttendanceIds = attendanceRows.map((row) => row.id);
  const breaksResult = openAttendanceIds.length
    ? await admin.from("office_attendance_breaks").select("attendance_session_id,user_id,started_at").in("attendance_session_id", openAttendanceIds).is("ended_at", null)
    : { data: [], error: null };
  if (breaksResult.error) throw new OfficeWorkforceOverviewError(503, "Attendance authority is temporarily unavailable");
  const usersOnBreak = new Set((breaksResult.data ?? []).map((row) => row.user_id as string));

  const people = identities.map((identity) => {
    const permanentIdentity = peopleRegistry.get(identity.user_id);
    const employment = employments.get(identity.user_id);
    const job = jobs.get(identity.user_id);
    const rawPresence = presence.get(identity.user_id);
    const effectivePresence = effectiveAvailability(rawPresence, now);
    const workStatus = statuses.get(identity.user_id);
    const openAttendance = attendance.get(identity.user_id);
    const authSession = auth.get(identity.user_id);
    return {
      user_id: identity.user_id,
      person_id: permanentIdentity?.person_id ?? null,
      person_code: permanentIdentity?.person_code ?? null,
      employment_id: employment?.employment_id ?? null,
      employment_code: employment?.employment_code ?? null,
      display_name: identity.display_name || "Unnamed Office identity",
      department: job?.department_code || identity.primary_department || "UNASSIGNED",
      job_title: identity.job_title || job?.position_code || "Team member",
      employment_type: employment?.relationship_type || job?.employment_type || null,
      employment_record_status: employment?.status ?? null,
      availability_status: effectivePresence.availability_status,
      work_mode: openAttendance?.work_mode || effectivePresence.work_mode,
      workforce_status: workStatus?.status ?? "WORKING",
      workforce_status_source: workStatus?.source ?? "SYSTEM",
      online_state: sessionPresence(authSession, now),
      session_aal: authSession?.aal ?? null,
      mfa_verified: authSession?.mfa_verified ?? false,
      session_started_at: authSession?.started_at ?? null,
      last_seen_at: authSession?.last_seen_at ?? null,
      risk_level: authSession?.risk_level ?? null,
      attendance_state: openAttendance ? (usersOnBreak.has(identity.user_id) ? "ON_BREAK" : "WORKING") : "OFF_CLOCK",
      check_in_at: openAttendance?.check_in_at ?? null,
      attendance_time_zone: openAttendance?.time_zone ?? null,
    };
  });

  const count = (key: keyof (typeof people)[number], value: unknown) => people.filter((person) => person[key] === value).length;
  return {
    generated_at: nowIso,
    summary: {
      active_people: people.length,
      online: count("online_state", "ONLINE"),
      idle: count("online_state", "IDLE"),
      remote: count("work_mode", "REMOTE"),
      office: count("work_mode", "OFFICE"),
      on_leave: people.filter((person) => ["PAID_LEAVE", "SICK_LEAVE", "UNPAID_LEAVE"].includes(person.workforce_status)).length,
      ooo: count("availability_status", "OOO"),
      checked_in: people.filter((person) => person.attendance_state !== "OFF_CLOCK").length,
    },
    people,
  };
}
