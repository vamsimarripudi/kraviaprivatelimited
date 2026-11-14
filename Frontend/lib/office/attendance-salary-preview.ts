/**
 * HR salary preview from independently reviewed work evidence.
 * A missing check-in is NEVER interpreted as unpaid leave or absence.
 * The preview deliberately retains unresolved scheduled hours until HR
 * attaches verified paid leave, holiday or absence evidence.
 */
import { IST_OFFSET_MS, type ApprovedWorkSession } from "./worktime-payroll-policy";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export type ApprovedLeaveEvidence = {
  id: string;
  employeeUserId: string;
  status: "APPROVED";
  requestedBy: string;
  reviewedBy: string;
  startsOn: string;
  endsOn: string;
  payClass: "PAID_LEAVE" | "UNPAID_LEAVE" | "SICK_PAID" | "HOLIDAY_PAID";
  minutesPerWeekday: number;
};

export type VerifiedAttendancePreview = {
  month: string;
  basisMinutes: number;
  approvedRegularMinutes: number;
  approvedPaidLeaveMinutes: number;
  approvedUnpaidLeaveMinutes: number;
  unresolvedMinutes: number;
  potentialWeekdayOvertimeMinutes: number;
  optionalWeekendMinutes: number;
  scheduledWeekdays: number;
  verifiedWeekdays: number;
  sourceSessionIds: string[];
  sourceLeaveIds: string[];
  estimatedRegularGrossMinor: number | null;
  readyForPayroll: boolean;
};

function milliseconds(iso: string): number {
  const value = Date.parse(iso);
  if (!Number.isFinite(value)) throw new Error("Invalid verified worktime timestamp");
  return value;
}
function spans(session: ApprovedWorkSession): Array<{ start: number; end: number }> {
  const start = milliseconds(session.startAt);
  const end = milliseconds(session.endAt);
  if (end <= start || end - start > DAY_MS) throw new Error("Invalid verified worktime range");
  const breaks = (session.breaks || []).map(item => ({
    start: milliseconds(item.startAt), end: milliseconds(item.endAt),
  })).sort((a, b) => a.start - b.start);
  const out: Array<{ start: number; end: number }> = [];
  let cursor = start;
  for (const rest of breaks) {
    if (rest.start < cursor || rest.end <= rest.start || rest.end > end) {
      throw new Error("Invalid or overlapping unpaid break");
    }
    if (cursor < rest.start) out.push({ start: cursor, end: rest.start });
    cursor = rest.end;
  }
  if (cursor < end) out.push({ start: cursor, end });
  return out;
}
function roundMinutes(ms: number): number { return Math.round(ms / MINUTE_MS * 1000) / 1000; }

/** 6 net weekday hours are the current attendance TARGET, not a salary reduction order. */
export function calculateVerifiedMonthlyAttendance(input: {
  month: string;
  employeeUserId: string;
  sessions: readonly ApprovedWorkSession[];
  leaveEvidence?: readonly ApprovedLeaveEvidence[];
  monthlyGrossMinor: number | null;
  dailyTargetMinutes?: number;
}): VerifiedAttendancePreview {
  const { month, employeeUserId, sessions, leaveEvidence = [], monthlyGrossMinor, dailyTargetMinutes = 360 } = input;
  if (!monthPattern.test(month) || !employeeUserId.trim()) throw new Error("Employee and valid payroll month are required");
  if (!Number.isSafeInteger(dailyTargetMinutes) || dailyTargetMinutes < 60 || dailyTargetMinutes > 600) {
    throw new Error("Invalid approved daily target");
  }
  if (monthlyGrossMinor !== null && (!Number.isSafeInteger(monthlyGrossMinor) || monthlyGrossMinor < 0)) {
    throw new Error("Invalid monthly gross pay");
  }
  const [year, index] = month.split("-").map(Number);
  const first = Date.UTC(year, index - 1, 1);
  const next = Date.UTC(year, index, 1);
  const dayValues = new Map<string, number>();
  let weekendMs = 0;
  const usedIds: string[] = [];
  const sorted = sessions.flatMap(session => {
    if (session.reviewStatus !== "APPROVED" || !session.reviewedBy ||
        session.reviewedBy === employeeUserId || session.employeeUserId !== employeeUserId || !session.id) {
      throw new Error("Only independently verified employee worktime is eligible");
    }
    return spans(session).map(span => ({ ...span, sourceId: session.id }));
  }).sort((a, b) => a.start - b.start);

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) throw new Error("Overlapping approved worktime must be corrected before payroll");
  }
  for (const span of sorted) {
    for (let at = span.start; at < span.end;) {
      const istDay = Math.floor((at + IST_OFFSET_MS) / DAY_MS);
      const nextDay = (istDay + 1) * DAY_MS - IST_OFFSET_MS;
      const end = Math.min(span.end, nextDay);
      const localDayUtc = istDay * DAY_MS;
      if (localDayUtc >= first && localDayUtc < next) {
        const day = new Date(localDayUtc).toISOString().slice(0, 10);
        const weekday = new Date(localDayUtc).getUTCDay();
        if (weekday === 0 || weekday === 6) weekendMs += end - at;
        else dayValues.set(day, (dayValues.get(day) || 0) + end - at);
        usedIds.push(span.sourceId);
      }
      at = end;
    }
  }

  const paidLeaveMsByDay = new Map<string,number>();
  const unpaidLeaveMsByDay = new Map<string,number>();
  const approvedLeaveIds: string[] = [];
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  for (const leave of leaveEvidence) {
    if (leave.status !== "APPROVED" || !leave.id || !leave.reviewedBy ||
        leave.reviewedBy === employeeUserId || leave.reviewedBy === leave.requestedBy ||
        leave.employeeUserId !== employeeUserId ||
        !datePattern.test(leave.startsOn) || !datePattern.test(leave.endsOn) ||
        leave.endsOn < leave.startsOn || !Number.isSafeInteger(leave.minutesPerWeekday) ||
        leave.minutesPerWeekday < 30 || leave.minutesPerWeekday > dailyTargetMinutes) {
      throw new Error("Only independently approved, source-backed leave within the work policy can affect pay");
    }
    if (!["PAID_LEAVE","UNPAID_LEAVE","SICK_PAID","HOLIDAY_PAID"].includes(leave.payClass)) {
      throw new Error("Unrecognized paid/unpaid leave policy classification");
    }
    for (let day = first; day < next; day += DAY_MS) {
      const date = new Date(day).toISOString().slice(0,10);
      if (date < leave.startsOn || date > leave.endsOn) continue;
      const weekday = new Date(day).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      const target = leave.payClass === "UNPAID_LEAVE" ? unpaidLeaveMsByDay : paidLeaveMsByDay;
      target.set(date,(target.get(date) || 0) + leave.minutesPerWeekday * MINUTE_MS);
      approvedLeaveIds.push(leave.id);
    }
  }
  let scheduledWeekdays = 0;
  let verifiedWeekdays = 0;
  let regularMs = 0;
  let paidLeaveMs = 0;
  let unpaidLeaveMs = 0;
  let overtimeMs = 0;
  const dailyLimitMs = dailyTargetMinutes * MINUTE_MS;
  for (let day = first; day < next; day += DAY_MS) {
    const weekday = new Date(day).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    scheduledWeekdays++;
    const localDay = new Date(day).toISOString().slice(0, 10);
    const evidence = dayValues.get(localDay) || 0;
    const regular = Math.min(evidence, dailyLimitMs);
    const approvedPaid = paidLeaveMsByDay.get(localDay) || 0;
    const approvedUnpaid = unpaidLeaveMsByDay.get(localDay) || 0;
    if (regular + approvedPaid + approvedUnpaid > dailyLimitMs) {
      throw new Error("Approved leave overlaps real worked hours or exceeds the daily target; HR must reconcile sources");
    }
    if (regular >= dailyLimitMs) verifiedWeekdays++;
    regularMs += regular;
    paidLeaveMs += approvedPaid;
    unpaidLeaveMs += approvedUnpaid;
    overtimeMs += Math.max(0, evidence - dailyLimitMs);
  }
  const basisMs = scheduledWeekdays * dailyLimitMs;
  const unresolvedMs = Math.max(0, basisMs - regularMs - paidLeaveMs - unpaidLeaveMs);
  const estimatedRegularGrossMinor = monthlyGrossMinor === null ? null :
    Number((BigInt(monthlyGrossMinor) * BigInt(regularMs + paidLeaveMs) + BigInt(basisMs) / 2n) / BigInt(basisMs));
  return {
    month, basisMinutes: roundMinutes(basisMs), approvedRegularMinutes: roundMinutes(regularMs),
    approvedPaidLeaveMinutes: roundMinutes(paidLeaveMs),
    approvedUnpaidLeaveMinutes: roundMinutes(unpaidLeaveMs),
    unresolvedMinutes: roundMinutes(unresolvedMs),
    potentialWeekdayOvertimeMinutes: roundMinutes(overtimeMs),
    optionalWeekendMinutes: roundMinutes(weekendMs),
    scheduledWeekdays, verifiedWeekdays, sourceSessionIds: [...new Set(usedIds)].sort(), sourceLeaveIds: [...new Set(approvedLeaveIds)].sort(),
    estimatedRegularGrossMinor,
    readyForPayroll: unresolvedMs === 0 && monthlyGrossMinor !== null,
  };
}
