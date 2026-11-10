/**
 * KRAVIA Office work-time premium engine. No salary is paid/issued by this
 * module. Only independently reviewed sessions and a Board-approved policy
 * may contribute an earnings adjustment to the existing payroll engine.
 *
 * All day/night/week classifications use India Standard Time (UTC+05:30).
 * Amounts are integer paise. Round each FINAL line item once; do not round
 * the hourly rate or each attendance minute.
 */
export const IST_OFFSET_MS = 330 * 60_000;
const MINUTE_MS = 60_000;

export type ApprovedWorkPolicy = {
  status: "APPROVED";
  authorityReference: string;
  effectiveFrom: string; // YYYY-MM-DD, not the document's signing date
  referenceMonthlyMinutes: number; // 130 hours => 7800 minutes
  regularDailyMinutes: number; // six hours => 360 minutes
  weekdayOvertimeBasisPoints: number; // 2x => 20_000
  weekendBasisPoints: number; // 3x => 30_000
  nightPremiumBasisPoints: number; // +20% => 2_000
  nightStartsHour: number; // 22
  nightEndsHour: number; // 6
  weeklyTargetMinutes: number; // 30h => 1800 minutes
  maxDailyMinutes: number; // legal safety review threshold, e.g. 600
  maxWeeklyMinutes: number; // legal safety review threshold, e.g. 2880
};
export type ApprovedWorkSession = {
  id: string;
  employeeUserId: string;
  startAt: string;
  endAt: string;
  breaks?: Array<{ startAt: string; endAt: string }>;
  reviewStatus: "APPROVED";
  reviewedBy: string; // must be a distinct verified human
};
export type WorkPremiumResult = {
  employeeUserId: string;
  workedMinutes: number;
  weekdayBaseMinutes: number;
  weekdayOvertimeMinutes: number;
  weekendMinutes: number;
  nightMinutes: number;
  weekdayOvertimeMinor: number;
  weekendPremiumMinor: number;
  nightPremiumMinor: number;
  totalAdditionalEarningsMinor: number;
  flexDayEligibleWeeks: string[];
  flexDaysEarnedThisMonth: number;
  warnings: string[];
  sourceSessionIds: string[];
  authorityReference: string;
  policyEffectiveFrom: string;
};
type Span = { start: number; end: number };
function assertInt(value: number, minimum: number, message: string) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(message);
}
function asMs(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid attendance timestamp");
  return parsed;
}
function localDate(ms: number) {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}
function dateWeekday(date: string): number {
  return new Date(date + "T00:00:00Z").getUTCDay();
}
function monday(date: string): string {
  const dt = new Date(date + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - (dt.getUTCDay() + 6) % 7);
  return dt.toISOString().slice(0, 10);
}
function toPayMinor(grossMinor: number, workedMillis: number, rateBps: number, refMonthlyMinutes: number): number {
  if (!workedMillis || !rateBps) return 0;
  const numerator = BigInt(grossMinor) * BigInt(workedMillis) * BigInt(rateBps);
  const denominator = BigInt(refMonthlyMinutes) * BigInt(MINUTE_MS) * 10_000n;
  const rounded = (numerator + denominator / 2n) / denominator;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Payroll amount exceeds safe range");
  return Number(rounded);
}
function subtractBreaks(session: ApprovedWorkSession): Span[] {
  const start = asMs(session.startAt);
  const end = asMs(session.endAt);
  if (end <= start || end - start > 24 * 60 * MINUTE_MS) throw new Error("Invalid or excessive attendance session");
  const breaks = (session.breaks ?? []).map(b => ({ start: asMs(b.startAt), end: asMs(b.endAt) }))
    .sort((a, b) => a.start - b.start);
  let previous = start;
  const result: Span[] = [];
  for (const b of breaks) {
    if (b.start < previous || b.end <= b.start || b.end > end) throw new Error("Overlapping or invalid attendance break");
    if (b.start > previous) result.push({ start: previous, end: b.start });
    previous = b.end;
  }
  if (previous < end) result.push({ start: previous, end });
  return result;
}
function assertPolicy(p: ApprovedWorkPolicy): void {
  if (p.status !== "APPROVED" || !p.authorityReference.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(p.effectiveFrom)) {
    throw new Error("A dated, approved work policy with authority evidence is required");
  }
  for (const [key, v] of Object.entries({
    referenceMonthlyMinutes: p.referenceMonthlyMinutes,
    regularDailyMinutes: p.regularDailyMinutes,
    weeklyTargetMinutes: p.weeklyTargetMinutes,
    maxDailyMinutes: p.maxDailyMinutes,
    maxWeeklyMinutes: p.maxWeeklyMinutes,
    weekdayOvertimeBasisPoints: p.weekdayOvertimeBasisPoints,
    weekendBasisPoints: p.weekendBasisPoints,
    nightPremiumBasisPoints: p.nightPremiumBasisPoints,
  })) assertInt(v, 0, "Invalid policy number: " + key);
  if (p.referenceMonthlyMinutes <= 0 || p.regularDailyMinutes <= 0 || p.maxDailyMinutes < p.regularDailyMinutes ||
      p.weekdayOvertimeBasisPoints < 20_000 || p.weekendBasisPoints < 20_000 ||
      p.nightPremiumBasisPoints > 10_000 ||
      !Number.isInteger(p.nightStartsHour) || !Number.isInteger(p.nightEndsHour) ||
      p.nightStartsHour < 0 || p.nightStartsHour > 23 || p.nightEndsHour < 0 || p.nightEndsHour > 23) {
    throw new Error("Policy fails safe compensation and shift bounds");
  }
}
/**
 * Only closed, approved attendance is accepted. Session overlaps are rejected
 * (including overlap with an otherwise valid break), so one worked minute
 * cannot earn more than one base/weekend classification.
 */
export function calculateApprovedWorkPremiums(input: {
  month: string; employeeUserId: string; monthlyGrossMinor: number;
  sessions: ApprovedWorkSession[]; policy: ApprovedWorkPolicy;
}): WorkPremiumResult {
  const { month, employeeUserId, monthlyGrossMinor, sessions, policy } = input;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must be YYYY-MM");
  if (!employeeUserId.trim()) throw new Error("Employee identity is required");
  assertInt(monthlyGrossMinor, 0, "Invalid monthly salary");
  assertPolicy(policy);
  const spans = sessions.flatMap(s => {
    if (s.reviewStatus !== "APPROVED" || !s.reviewedBy || s.reviewedBy === employeeUserId ||
        s.employeeUserId !== employeeUserId || !s.id) {
      throw new Error("Only independently approved sessions for this employee can affect payroll");
    }
    const parts = subtractBreaks(s);
    if (parts.some(part => localDate(part.start) < policy.effectiveFrom)) {
      throw new Error("Attendance predates approved policy; use an explicit authorised retroactive policy");
    }
    return parts.map(part => ({ ...part, sourceId: s.id }));
  }).sort((a, b) => a.start - b.start);
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].start < spans[i - 1].end) throw new Error("Overlapping attendance would double-pay work");
  }
  const inMonth = (date: string) => date.startsWith(month);
  const dayMs = new Map<string, number>();
  const weekMs = new Map<string, number>();
  const weekdayWeekMs = new Map<string, number>();
  const warnings: string[] = [];
  // A >6-hour session must have a qualifying rest interval. Record the legal
  // exception without deleting wages already earned; block automatic import.
  for (const session of sessions) {
    const total = asMs(session.endAt) - asMs(session.startAt);
    const breakIntervals = (session.breaks ?? []).map(b => ({ start: asMs(b.startAt), end: asMs(b.endAt) }));
    if (total > policy.regularDailyMinutes * MINUTE_MS &&
        !breakIntervals.some(b => b.end - b.start >= 30 * MINUTE_MS)) {
      warnings.push(session.id + ": statutory rest interval requires review");
    }
  }
  let weekdayBaseMs = 0, weekdayOtMs = 0, weekendMs = 0, nightMs = 0, totalMs = 0;
  for (const span of spans) {
    for (let at = span.start; at < span.end;) {
      const next = Math.min(span.end, Math.floor(at / MINUTE_MS + 1) * MINUTE_MS);
      const dt = localDate(at);
      if (!inMonth(dt)) {
        // A cross-month shift belongs to its actual calendar day; the caller
        // must include the previous month's session when calculating next month.
        at = next; continue;
      }
      const amount = next - at;
      const weekday = dateWeekday(dt);
      const previous = dayMs.get(dt) ?? 0;
      dayMs.set(dt, previous + amount);
      const week = monday(dt);
      weekMs.set(week, (weekMs.get(week) ?? 0) + amount);
      totalMs += amount;
      if (weekday === 0 || weekday === 6) weekendMs += amount;
      else {
        const availableBase = Math.max(0, policy.regularDailyMinutes * MINUTE_MS - previous);
        const base = Math.min(availableBase, amount);
        weekdayBaseMs += base; weekdayOtMs += amount - base;
        weekdayWeekMs.set(week, (weekdayWeekMs.get(week) ?? 0) + amount);
      }
      const localHour = new Date(at + IST_OFFSET_MS).getUTCHours();
      const night = policy.nightStartsHour < policy.nightEndsHour
        ? localHour >= policy.nightStartsHour && localHour < policy.nightEndsHour
        : localHour >= policy.nightStartsHour || localHour < policy.nightEndsHour;
      if (night) nightMs += amount;
      at = next;
    }
  }
  for (const [date, worked] of dayMs) {
    if (worked > policy.maxDailyMinutes * MINUTE_MS) warnings.push(date + ": over configured daily work limit");
  }
  for (const [week, worked] of weekMs) {
    if (worked > policy.maxWeeklyMinutes * MINUTE_MS) warnings.push(week + ": over configured weekly work limit");
  }
  const completedWeeks = [...weekdayWeekMs.entries()].filter(([start, worked]) => {
    const friday = new Date(start + "T00:00:00Z");
    friday.setUTCDate(friday.getUTCDate() + 4);
    // A 30-hour week compressed into three long days is NOT five completed
    // six-hour weekdays. Require all five scheduled days, net of breaks.
    const fullFiveDays = Array.from({ length: 5 }, (_, offset) => {
      const day = new Date(start + "T00:00:00Z");
      day.setUTCDate(day.getUTCDate() + offset);
      return (dayMs.get(day.toISOString().slice(0, 10)) ?? 0) >=
        policy.regularDailyMinutes * MINUTE_MS;
    }).every(Boolean);
    return friday.toISOString().slice(0, 7) === month &&
      worked >= policy.weeklyTargetMinutes * MINUTE_MS && fullFiveDays;
  }).map(([week]) => week).sort();
  const weekdayOvertimeMinor = toPayMinor(monthlyGrossMinor, weekdayOtMs, policy.weekdayOvertimeBasisPoints, policy.referenceMonthlyMinutes);
  const weekendPremiumMinor = toPayMinor(monthlyGrossMinor, weekendMs, policy.weekendBasisPoints, policy.referenceMonthlyMinutes);
  const nightPremiumMinor = toPayMinor(monthlyGrossMinor, nightMs, policy.nightPremiumBasisPoints, policy.referenceMonthlyMinutes);
  const minutes = (ms: number) => Math.round(ms / MINUTE_MS * 1000) / 1000;
  return {
    employeeUserId,
    workedMinutes: minutes(totalMs),
    weekdayBaseMinutes: minutes(weekdayBaseMs),
    weekdayOvertimeMinutes: minutes(weekdayOtMs),
    weekendMinutes: minutes(weekendMs),
    nightMinutes: minutes(nightMs),
    weekdayOvertimeMinor, weekendPremiumMinor, nightPremiumMinor,
    totalAdditionalEarningsMinor: weekdayOvertimeMinor + weekendPremiumMinor + nightPremiumMinor,
    flexDayEligibleWeeks: completedWeeks,
    flexDaysEarnedThisMonth: Math.min(1, completedWeeks.length),
    warnings,
    sourceSessionIds: [...new Set(sessions.map(s => s.id))],
    authorityReference: policy.authorityReference,
    policyEffectiveFrom: policy.effectiveFrom,
  };
}
/** Date is a company target, NOT proof of bank settlement or legal holiday. */
export function targetSalaryDate(month: string): { date: string; time: "18:00 IST"; bankHolidayVerificationRequired: true } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must be YYYY-MM");
  const [year, index] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const date = new Date(Date.UTC(year, index - 1, Math.min(index === 2 ? 28 : 30, last)));
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() - 1);
  return { date: date.toISOString().slice(0, 10), time: "18:00 IST", bankHolidayVerificationRequired: true };
}
/** Payment status can only advance from bank-confirmed, reconciled evidence. */
export function reconcileWageDebt(netPayableMinor: number, confirmedPaymentsMinor: readonly number[]) {
  assertInt(netPayableMinor, 0, "Invalid payable salary");
  for (const v of confirmedPaymentsMinor) assertInt(v, 0, "Unverified payment amount");
  const confirmedMinor = confirmedPaymentsMinor.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(confirmedMinor) || confirmedMinor > netPayableMinor) throw new Error("Confirmed payments exceed wages owed");
  const balanceMinor = netPayableMinor - confirmedMinor;
  return { confirmedMinor, balanceMinor,
    status: balanceMinor === 0 ? "PAID" as const : confirmedMinor === 0 ? "UNPAID" as const : "PARTIAL" as const };
}
/** Optional agreed interest; never infer it as a statutory default. */
export function agreedLateWageInterest(input: { balanceMinor: number; daysOverdue: number; annualRateBasisPoints: number; boardAuthorityReference: string }) {
  const { balanceMinor, daysOverdue, annualRateBasisPoints, boardAuthorityReference } = input;
  if (!boardAuthorityReference.trim()) throw new Error("A signed company interest policy is required");
  assertInt(balanceMinor, 0, "Invalid salary balance");
  assertInt(daysOverdue, 0, "Invalid overdue days");
  assertInt(annualRateBasisPoints, 0, "Invalid approved interest rate");
  const denominator = 365n * 10_000n;
  return Number((BigInt(balanceMinor) * BigInt(daysOverdue) * BigInt(annualRateBasisPoints) + denominator / 2n) / denominator);
}
