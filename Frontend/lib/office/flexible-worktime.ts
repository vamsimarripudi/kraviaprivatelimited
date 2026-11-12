/** KRAVIA attendance targets. A logged session is NOT a payroll approval.
 * Date boundaries are India Standard Time. Historical corrections count only
 * after independent approval; open sessions include elapsed time less breaks.
 * Do not mark absent from missing data or turn candidates into paid overtime.
 */
export const WORKTIME_HISTORY_START = "2026-08-01";
export const WORKTIME_DAILY_ENFORCEMENT_START = "2026-11-14";
export const DAILY_TARGET_MINUTES = 360;
export const WEEKLY_TARGET_MINUTES = 1_800;
export const IST_OFFSET_MILLISECONDS = 330 * 60_000;
const DAY = 86_400_000;
const MINUTE = 60_000;

export type WorktimeBreak = { startAt: string; endAt: string };
export type TrackedSession = {
  id: string; check_in_at: string; check_out_at: string | null; status: string;
};
export type HistoricalWorkClaim = {
  id: string; work_starts_at: string; work_ends_at: string; status: string;
  source_kind: string; breaks: unknown;
};
export type WorktimeDay = {
  date: string; weekday: number; recorded_minutes: number; approved_historical_minutes: number;
  total_minutes: number; daily_target_minutes: number; remaining_minutes: number;
  potential_overtime_minutes: number; weekend_minutes: number;
  status: "TARGET_MET" | "IN_PROGRESS" | "NOT_RECORDED" | "HISTORICAL" | "NON_WORKDAY";
};
export type WorktimeWeek = {
  monday: string; through: string; tracked_minutes: number; target_minutes: number;
  remaining_minutes: number; potential_overtime_minutes: number;
  weekend_minutes: number; status: "TARGET_MET" | "IN_PROGRESS" | "HISTORICAL";
};
export type WorktimeTargets = {
  history_from: string; required_from: string; daily_target_minutes: number;
  weekly_target_minutes: number; day_records: WorktimeDay[]; weeks: WorktimeWeek[];
  recorded_minutes: number; approved_historical_minutes: number; total_minutes: number;
  potential_overtime_minutes: number; today: WorktimeDay | null; current_week: WorktimeWeek | null;
  message: string;
};
type Span = { start: number; end: number };
type DaySpans = { recorded: Span[]; historical: Span[] };

export function istCalendarDate(timestamp: number): string {
  return new Date(timestamp + IST_OFFSET_MILLISECONDS).toISOString().slice(0, 10);
}
function dateOf(date: string) { return new Date(date + "T00:00:00Z"); }
export function weekMonday(date: string): string {
  const day = dateOf(date);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
function addDays(date: string, n: number) {
  const value = dateOf(date);
  value.setUTCDate(value.getUTCDate() + n);
  return value.toISOString().slice(0, 10);
}
function minutes(spans: Span[]): number {
  const merged: Span[] = [];
  for (const part of [...spans].sort((a, b) => a.start - b.start)) {
    if (part.end <= part.start) continue;
    const last = merged.at(-1);
    if (last && part.start <= last.end) last.end = Math.max(last.end, part.end);
    else merged.push({ ...part });
  }
  return Math.floor(merged.reduce((sum, part) => sum + part.end - part.start, 0) / MINUTE);
}
function netSpans(startValue: string, endValue: string | null, breaks: WorktimeBreak[], asOf: number): Span[] {
  const start = Date.parse(startValue);
  const end = endValue ? Date.parse(endValue) : asOf;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || start > asOf) return [];
  const boundEnd = Math.min(end, asOf);
  const validBreaks = breaks.map(b => ({ start: Date.parse(b.startAt), end: Date.parse(b.endAt) }))
    .filter(b => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
    .sort((a, b) => a.start - b.start);
  const spans: Span[] = [];
  let cursor = start;
  for (const b of validBreaks) {
    if (b.end <= cursor || b.start >= boundEnd) continue;
    if (b.start > cursor) spans.push({ start: cursor, end: Math.min(b.start, boundEnd) });
    cursor = Math.min(boundEnd, Math.max(cursor, b.end));
  }
  if (cursor < boundEnd) spans.push({ start: cursor, end: boundEnd });
  return spans;
}
export function monthlyFlexibleWorktime(input: {
  month: string; now: number; sessions: TrackedSession[]; breaksBySession: Record<string, WorktimeBreak[]>;
  historicalClaims: HistoricalWorkClaim[];
}): WorktimeTargets {
  const { month, now, sessions, breaksBySession, historicalClaims } = input;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isFinite(now)) throw new Error("Invalid worktime period");
  const today = istCalendarDate(now);
  const work: Record<string, DaySpans> = {};
  function allocate(spans: Span[], kind: "recorded" | "historical") {
    for (const span of spans) {
      for (let cursor = span.start; cursor < span.end;) {
        const untilMidnight = (Math.floor((cursor + IST_OFFSET_MILLISECONDS) / DAY) + 1) * DAY - IST_OFFSET_MILLISECONDS;
        const end = Math.min(span.end, untilMidnight);
        const date = istCalendarDate(cursor);
        if (date >= WORKTIME_HISTORY_START && date.startsWith(month) && date <= today) {
          const record = work[date] ?? { recorded: [], historical: [] };
          record[kind].push({ start: cursor, end });
          work[date] = record;
        }
        cursor = end;
      }
    }
  }
  for (const session of sessions) {
    if (!session.id || (session.status !== "OPEN" && session.status !== "CLOSED")) continue;
    allocate(netSpans(session.check_in_at, session.check_out_at, breaksBySession[session.id] ?? [], now), "recorded");
  }
  for (const claim of historicalClaims) {
    if (claim.status !== "APPROVED" || claim.source_kind !== "HISTORICAL_CORRECTION" || !Array.isArray(claim.breaks)) continue;
    const breaks = claim.breaks.filter(b => b && typeof b === "object" &&
      typeof b.startAt === "string" && typeof b.endAt === "string") as WorktimeBreak[];
    allocate(netSpans(claim.work_starts_at, claim.work_ends_at, breaks, now), "historical");
  }

  const first = month + "-01";
  const until = addDays(addDays(month + "-01", 32).slice(0, 7) + "-01", -1);
  const dayRecords: WorktimeDay[] = [];
  for (let date = first; date <= until && date <= today; date = addDays(date, 1)) {
    if (date < WORKTIME_HISTORY_START) continue;
    const weekday = dateOf(date).getUTCDay();
    const day = work[date] ?? { recorded: [], historical: [] };
    const recorded = minutes(day.recorded);
    const historical = minutes(day.historical);
    const total = minutes([...day.recorded, ...day.historical]);
    const regularDay = weekday >= 1 && weekday <= 5;
    // Weekend work is recorded, not an automatically required six-hour day.
    const required = regularDay && date >= WORKTIME_DAILY_ENFORCEMENT_START ? DAILY_TARGET_MINUTES : 0;
    const candidate = regularDay ? Math.max(0, total - DAILY_TARGET_MINUTES) : 0;
    const status: WorktimeDay["status"] = required === 0
      ? date < WORKTIME_DAILY_ENFORCEMENT_START ? "HISTORICAL" : "NON_WORKDAY"
      : total >= required ? "TARGET_MET" : total > 0 ? "IN_PROGRESS" : "NOT_RECORDED";
    dayRecords.push({
      date, weekday, recorded_minutes: recorded, approved_historical_minutes: historical,
      total_minutes: total, daily_target_minutes: required, remaining_minutes: Math.max(0, required - total),
      potential_overtime_minutes: candidate, weekend_minutes: regularDay ? 0 : total, status,
    });
  }
  const grouped = new Map<string, WorktimeDay[]>();
  for (const day of dayRecords) {
    const monday = weekMonday(day.date);
    grouped.set(monday, [...(grouped.get(monday) ?? []), day]);
  }
  const weeks = [...grouped.entries()].map(([monday, days]): WorktimeWeek => {
    const tracked = days.filter(d => d.weekday >= 1 && d.weekday <= 5).reduce((sum, day) => sum + day.total_minutes, 0);
    // A month-only read cannot judge weeks whose other weekdays fall in another month.
    const completeMonthWeek = monday >= first && addDays(monday, 4) <= until;
    const target = completeMonthWeek && monday >= WORKTIME_DAILY_ENFORCEMENT_START ? WEEKLY_TARGET_MINUTES : 0;
    return {
      monday, through: addDays(monday, 6), tracked_minutes: tracked,
      target_minutes: target, remaining_minutes: Math.max(0, target - tracked),
      potential_overtime_minutes: days.reduce((sum, d) => sum + d.potential_overtime_minutes, 0),
      weekend_minutes: days.reduce((sum, d) => sum + d.weekend_minutes, 0),
      status: target === 0 ? "HISTORICAL" : tracked >= target ? "TARGET_MET" : "IN_PROGRESS",
    };
  });
  const thisWeek = weekMonday(today);
  return {
    history_from: WORKTIME_HISTORY_START, required_from: WORKTIME_DAILY_ENFORCEMENT_START,
    daily_target_minutes: DAILY_TARGET_MINUTES, weekly_target_minutes: WEEKLY_TARGET_MINUTES,
    day_records: dayRecords, weeks,
    recorded_minutes: dayRecords.reduce((sum, d) => sum + d.recorded_minutes, 0),
    approved_historical_minutes: dayRecords.reduce((sum, d) => sum + d.approved_historical_minutes, 0),
    total_minutes: dayRecords.reduce((sum, d) => sum + d.total_minutes, 0),
    potential_overtime_minutes: dayRecords.reduce((sum, d) => sum + d.potential_overtime_minutes, 0),
    today: dayRecords.find(d => d.date === today) ?? null,
    current_week: weeks.find(w => w.monday === thisWeek) ?? null,
    message: "6 net hours on each working weekday, 30 net hours Monday-Friday. No fixed login time. A missing check-in is unverified, not automatically an absence. Potential overtime is not approved or paid until independent HR/payroll review.",
  };
}
