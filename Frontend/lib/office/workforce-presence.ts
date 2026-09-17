export const officeAvailabilityOptions = [
  { value: "AVAILABLE", label: "Available", emoji: "🟢" },
  { value: "FOCUS", label: "Focus", emoji: "🟡" },
  { value: "IN_MEETING", label: "In Meeting", emoji: "🔵" },
  { value: "OOO", label: "OOO", emoji: "🟠" },
  { value: "DND", label: "Do Not Disturb", emoji: "🔴" },
] as const;

export const officeWorkModeOptions = [
  { value: "OFFICE", label: "In Office", emoji: "🏢" },
  { value: "REMOTE", label: "Remote", emoji: "🟣" },
  { value: "BUSINESS_TRAVEL", label: "Business Travel", emoji: "🚗" },
] as const;

export const officeEmploymentStatusMeta = {
  WORKING: { label: "Working", emoji: "💼" },
  PAID_LEAVE: { label: "On Leave", emoji: "🌴" },
  SICK_LEAVE: { label: "Sick Leave", emoji: "🤒" },
  UNPAID_LEAVE: { label: "Unpaid Leave", emoji: "⏸️" },
  HOLIDAY: { label: "Holiday", emoji: "🎉" },
  WEEK_OFF: { label: "Week Off", emoji: "🛌" },
  BUSINESS_TRAVEL: { label: "Business Travel", emoji: "🚗" },
  SUSPENDED: { label: "Suspended", emoji: "⛔" },
  EXITED: { label: "Exited", emoji: "👋" },
} as const;

export type OfficeAvailabilityStatus = (typeof officeAvailabilityOptions)[number]["value"];
export type OfficeWorkMode = (typeof officeWorkModeOptions)[number]["value"] | "UNSPECIFIED";
export type OfficeEmploymentStatus = keyof typeof officeEmploymentStatusMeta;
export type OfficeAttendanceState = "OFF_CLOCK" | "WORKING" | "ON_BREAK";

export type PresenceRecord = {
  availability_status: OfficeAvailabilityStatus;
  work_mode: OfficeWorkMode;
  status_note?: string | null;
  status_until?: string | null;
};

export type AttendanceSessionTiming = {
  check_in_at: string;
  check_out_at?: string | null;
};

export type AttendanceBreakTiming = {
  started_at: string;
  ended_at?: string | null;
};

export function effectiveAvailability(record: PresenceRecord | null | undefined, now = Date.now()): PresenceRecord {
  if (!record) return { availability_status: "AVAILABLE", work_mode: "UNSPECIFIED", status_note: null, status_until: null };
  if (!record.status_until) return record;
  const expiry = Date.parse(record.status_until);
  if (!Number.isFinite(expiry) || expiry > now) return record;
  return { ...record, availability_status: "AVAILABLE", status_note: null, status_until: null };
}

export function attendanceState(hasOpenSession: boolean, hasOpenBreak: boolean): OfficeAttendanceState {
  if (!hasOpenSession) return "OFF_CLOCK";
  return hasOpenBreak ? "ON_BREAK" : "WORKING";
}

function secondsBetween(startValue: string, endValue: string | null | undefined, now: number) {
  const start = Date.parse(startValue);
  const end = endValue ? Date.parse(endValue) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.floor((end - start) / 1000);
}

export function trackedAttendanceSeconds(
  session: AttendanceSessionTiming | null | undefined,
  breaks: AttendanceBreakTiming[],
  now = Date.now(),
) {
  if (!session) return 0;
  const elapsed = secondsBetween(session.check_in_at, session.check_out_at, now);
  const breakSeconds = breaks.reduce((total, item) => total + secondsBetween(item.started_at, item.ended_at, now), 0);
  return Math.max(0, elapsed - breakSeconds);
}

export function availabilityOption(status: OfficeAvailabilityStatus) {
  return officeAvailabilityOptions.find((option) => option.value === status) ?? officeAvailabilityOptions[0];
}

export function workModeOption(mode: OfficeWorkMode) {
  return officeWorkModeOptions.find((option) => option.value === mode);
}
