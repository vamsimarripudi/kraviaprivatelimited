import "server-only";
import { createHash } from "node:crypto";
import { calculateVerifiedMonthlyAttendance } from "@/lib/office/attendance-salary-preview";
import { setPayrollAttendance } from "@/lib/office/payroll-server";
import { requireOfficeActor, resolveOfficePermission, type OfficePermissionDecision } from "@/lib/office/permission-engine";
import { monthlyFlexibleWorktime, type TrackedSession, type WorktimeBreak, type HistoricalWorkClaim } from "@/lib/office/flexible-worktime";
import { calculateApprovedWorkPremiums, reconcileWageDebt, targetSalaryDate,
  type ApprovedWorkPolicy, type ApprovedWorkSession } from "@/lib/office/worktime-payroll-policy";

export class OfficeWorktimeError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = "OfficeWorktimeError"; }
}
type Actor = Awaited<ReturnType<typeof requireOfficeActor>>;
type ClaimRow = {
  id: string; employee_user_id: string; attendance_session_id: string | null;
  work_starts_at: string; work_ends_at: string; breaks: unknown; source_reference: string; source_kind: "RECORDED_SESSION" | "HISTORICAL_CORRECTION";
  review_note: string | null; requested_by: string; reviewed_by: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
};
type PolicyRow = {
  id: string; status: string; effective_from: string; authority_reference: string;
  regular_daily_minutes: number; weekly_target_minutes: number; reference_monthly_minutes: number;
  weekday_ot_bps: number; weekend_bps: number; night_premium_bps: number;
  night_from_hour: number; night_until_hour: number;
  maximum_daily_minutes: number; maximum_weekly_minutes: number;
};
type CompensationRow = { id: string; monthly_gross_minor: number; currency: string; status: string };
type IssueRow = { id: string; payroll_result_id: string; employee_user_id: string; issue_code: string; snapshot: Record<string, unknown>; issued_at: string };

function check(result: { error?: { message?: string } | null }, message: string) {
  if (result.error) throw new OfficeWorktimeError(503, message);
}
function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new OfficeWorktimeError(400, "Invalid month");
  const [year, num] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, num - 1, 1));
  const last = new Date(Date.UTC(year, num, 0));
  // Include the preceding day for overnight sessions that enter this month.
  const from = new Date(first.getTime() - 86_400_000);
  const to = new Date(Date.UTC(year, num, 2));
  return { first: first.toISOString().slice(0, 10), last: last.toISOString().slice(0, 10),
    from: from.toISOString(), to: to.toISOString() };
}
async function can(actor: Actor, permission: string): Promise<boolean> {
  const result: OfficePermissionDecision = await resolveOfficePermission(actor.admin, actor.identity, permission, { type: "COMPANY" });
  return result.allowed;
}
function asApprovedPolicy(row: PolicyRow): ApprovedWorkPolicy {
  return {
    status: "APPROVED", authorityReference: row.authority_reference, effectiveFrom: row.effective_from,
    referenceMonthlyMinutes: Number(row.reference_monthly_minutes),
    regularDailyMinutes: Number(row.regular_daily_minutes),
    weekdayOvertimeBasisPoints: Number(row.weekday_ot_bps),
    weekendBasisPoints: Number(row.weekend_bps),
    nightPremiumBasisPoints: Number(row.night_premium_bps),
    nightStartsHour: Number(row.night_from_hour),
    nightEndsHour: Number(row.night_until_hour),
    weeklyTargetMinutes: Number(row.weekly_target_minutes),
    maxDailyMinutes: Number(row.maximum_daily_minutes),
    maxWeeklyMinutes: Number(row.maximum_weekly_minutes),
  };
}
function toApprovedSession(row: ClaimRow): ApprovedWorkSession {
  if (row.status !== "APPROVED" || !row.reviewed_by) throw new OfficeWorktimeError(409, "Unreviewed attendance cannot generate salary");
  if (!Array.isArray(row.breaks) || row.breaks.some(b => !b || typeof b !== "object" || typeof b.startAt !== "string" || typeof b.endAt !== "string")) {
    throw new OfficeWorktimeError(409, "Invalid approved attendance break evidence");
  }
  return {
    id: row.id, employeeUserId: row.employee_user_id,
    startAt: row.work_starts_at, endAt: row.work_ends_at,
    reviewStatus: "APPROVED", reviewedBy: row.reviewed_by,
    breaks: row.breaks as ApprovedWorkSession["breaks"],
  };
}
function defaultMonth() {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 7);
}
/**
 * Employees can read only their own attendance and payslips. Directors need
 * explicit People/Payroll read permission to inspect another employee.
 */
export async function officeWorktimeOverview(input: { month?: string; employeeUserId?: string } = {}) {
  const actor = await requireOfficeActor();
  const month = input.month || defaultMonth();
  const range = monthRange(month);
  const employeeId = input.employeeUserId || actor.identity.userId;
  const self = employeeId === actor.identity.userId;
  const [canReadOthers, canReviewWorktime, canPreparePayroll] = await Promise.all([
    Promise.all([can(actor, "people.sensitive.read"), can(actor, "payroll.run.read")]).then(([people, payroll]) => people || payroll),
    can(actor, "people.update"), can(actor, "payroll.run.prepare"),
  ]);
  if (!self && !canReadOthers) throw new OfficeWorktimeError(403, "Employee record is not assigned to you");
  const [identityResult, policiesResult, claimsResult, compensationResult, issuesResult, directoryResult, periodResult, flexResult, sessionsResult] = await Promise.all([
    actor.admin.from("office_identity_users").select("user_id,display_name,status").eq("user_id", employeeId).maybeSingle(),
    actor.admin.from("office_worktime_policy_versions").select("*").eq("employee_user_id", employeeId).lte("effective_from", range.last).order("effective_from", { ascending: false }).limit(12),
    actor.admin.from("office_worktime_review_cases").select("id,employee_user_id,attendance_session_id,work_starts_at,work_ends_at,breaks,source_kind,source_reference,request_reason,review_note,requested_by,reviewed_by,status").eq("employee_user_id", employeeId).gte("work_starts_at", range.from).lt("work_starts_at", range.to).order("work_starts_at"),
    actor.admin.from("office_compensation_versions").select("id,monthly_gross_minor,currency,status").eq("employee_user_id", employeeId).eq("status", "APPROVED").lte("effective_from", range.first).order("effective_from", { ascending: false }).limit(1),
    actor.admin.from("office_salary_payslip_issues").select("id,payroll_result_id,employee_user_id,issue_code,snapshot,issued_at").eq("employee_user_id", employeeId).order("issued_at", { ascending: false }).limit(60),
    canReadOthers ? actor.admin.from("office_identity_users").select("user_id,display_name,status").eq("status", "ACTIVE").order("display_name").limit(500) : Promise.resolve({ data: [], error: null }),
    canPreparePayroll ? actor.admin.from("office_payroll_periods")
      .select("id,period_code,starts_on,ends_on,status").eq("period_kind", "MONTHLY")
      .gte("starts_on", range.first).lte("starts_on", range.last)
      .order("starts_on", { ascending: false }).limit(12)
      : Promise.resolve({ data: [], error: null }),
    actor.admin.from("office_flex_day_requests")
      .select("id,employee_user_id,earned_month,earned_week_monday,leave_date,qualifying_work_minutes,status,requested_by,reviewed_by,reviewed_at")
      .eq("employee_user_id", employeeId).eq("earned_month", month).order("requested_at", { ascending: false }).limit(20),
    actor.admin.from("office_attendance_sessions")
      .select("id,check_in_at,check_out_at,status")
      .eq("user_id", employeeId).gte("check_in_at", range.from).lt("check_in_at", range.to)
      .order("check_in_at", { ascending: true }).limit(400),
  ]);
  for (const r of [identityResult, policiesResult, claimsResult, compensationResult, issuesResult, directoryResult, periodResult, flexResult, sessionsResult]) check(r, "Office worktime evidence is unavailable");
  if (!identityResult.data) throw new OfficeWorktimeError(404, "Employee not found");
  const manager = await actor.admin.from("office_user_access_profiles")
    .select("effective_from,expires_at").eq("user_id", actor.identity.userId)
    .eq("profile_code", "HR_MANAGER").eq("status", "ACTIVE");
  check(manager, "HR Manager authority is unavailable");
  const nowMs = Date.now();
  const hrManagerActive = (manager.data ?? []).some(row => {
    const from = row.effective_from ? Date.parse(String(row.effective_from)) : 0;
    const until = row.expires_at ? Date.parse(String(row.expires_at)) : Number.POSITIVE_INFINITY;
    return Number.isFinite(from) && from <= nowMs && until > nowMs;
  });
  const isDirector = actor.identity.roles.some(role => role === "OWNER" || role === "DIRECTOR");
  const policyProposal = isDirector && await can(actor, "payroll.rules.manage");
  const policies = (policiesResult.data ?? []) as PolicyRow[];
  const claims = (claimsResult.data ?? []) as ClaimRow[];
  const issues = (issuesResult.data ?? []) as IssueRow[];
  const sessions = (sessionsResult.data ?? []) as TrackedSession[];
  const breakResult = sessions.length
    ? await actor.admin.from("office_attendance_breaks")
        .select("attendance_session_id,started_at,ended_at")
        .in("attendance_session_id", sessions.map(session => session.id))
    : { data: [], error: null };
  check(breakResult, "Attendance break evidence is unavailable");
  const serverNow = Date.now();
  const breakMap: Record<string, WorktimeBreak[]> = {};
  for (const row of breakResult.data ?? []) {
    const key = String(row.attendance_session_id);
    const item = { startAt: String(row.started_at), endAt: row.ended_at ? String(row.ended_at) : new Date(serverNow).toISOString() };
    breakMap[key] = [...(breakMap[key] ?? []), item];
  }
  const attendanceTargets = monthlyFlexibleWorktime({
    month, now: serverNow, sessions, breaksBySession: breakMap, historicalClaims: claims as HistoricalWorkClaim[],
  });
  const policy = policies.find(x => x.status === "APPROVED");
  const compensation = (compensationResult.data ?? [])[0] as CompensationRow | undefined;
  let preview = null;
  const approvedClaims = claims.filter(x => x.status === "APPROVED").map(toApprovedSession);
  let salaryPreview;
  try {
    salaryPreview = calculateVerifiedMonthlyAttendance({
      month, employeeUserId: employeeId, sessions: approvedClaims,
      monthlyGrossMinor: compensation?.currency === "INR" ? Number(compensation.monthly_gross_minor) : null,
    });
  } catch (error) {
    throw new OfficeWorktimeError(409, error instanceof Error ? error.message : "Salary evidence needs reconciliation");
  }
  if (policy && compensation && compensation.currency === "INR") {
    try {
      preview = calculateApprovedWorkPremiums({
        month, employeeUserId: employeeId, monthlyGrossMinor: Number(compensation.monthly_gross_minor),
        policy: asApprovedPolicy(policy),
        sessions: approvedClaims,
      });
    } catch (error) {
      throw new OfficeWorktimeError(409, error instanceof Error ? error.message : "Approved time needs reconciliation");
    }
  }
  const resultIds = issues.map(item => item.payroll_result_id);
  const paidResult = resultIds.length
    ? await actor.admin.from("office_salary_settlement_evidence").select("payroll_result_id,amount_minor,status").in("payroll_result_id", resultIds).eq("status", "VERIFIED")
    : { data: [], error: null };
  check(paidResult, "Verified salary settlement evidence is unavailable");
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const salarySlips = issues.map(issue => {
    const net = Number(issue.snapshot.net_pay_minor || 0);
    const confirmed = (paidResult.data ?? []).filter(row => row.payroll_result_id === issue.payroll_result_id).map(row => Number(row.amount_minor));
    const balance = reconcileWageDebt(net, confirmed);
    const periodStart = String(issue.snapshot.period_start || "");
    const due = /^\d{4}-(0[1-9]|1[0-2])/.test(periodStart) ? targetSalaryDate(periodStart.slice(0, 7)).date : null;
    const status = balance.balanceMinor > 0 && balance.confirmedMinor === 0 && due && today <= due ? "PAYMENT_PENDING" : balance.status;
    return { id: issue.id, code: issue.issue_code, issued_at: issue.issued_at,
      period: String(issue.snapshot.period_code ?? ""), net_pay_minor: net,
      ...balance, status, due_date: due };
  });
  return {
    actor: { user_id: actor.identity.userId, roles: actor.identity.roles },
    employee: identityResult.data, employees: directoryResult.data ?? [], payroll_periods: periodResult.data ?? [], flex_days: flexResult.data ?? [], month, target_payment: targetSalaryDate(month),
    approved_policy: policy ?? null, policies, claims, preview, salary_preview: salaryPreview, attendance_targets: attendanceTargets,
    approved_monthly_gross_minor: compensation ? Number(compensation.monthly_gross_minor) : null,
    approved_gross_currency: compensation?.currency ?? null,
    salary_slips: salarySlips,
    capabilities: { self, review_worktime: canReviewWorktime && (isDirector || hrManagerActive), propose_policy: policyProposal, prepare_payroll: canPreparePayroll },
    notice: "Salary previews use approved compensation and independently verified net hours. Missing time remains UNRESOLVED, never automatically unpaid. Overtime requires approved policy and independent review. No payment is executed automatically.",
  };
}
export async function officeWorktimeAction(input:
  | { action: "SUBMIT"; employeeId?: string; sessionId?: string; startAt: string; endAt: string; breaks: unknown[]; sourceKind: "RECORDED_SESSION" | "HISTORICAL_CORRECTION"; sourceReference: string; reason: string }
  | { action: "AMEND_PENDING"; caseId: string; startAt: string; endAt: string; breaks: unknown[]; sourceReference: string; reason: string }
  | { action: "DECIDE"; caseId: string; decision: "APPROVE" | "REJECT"; note?: string }
  | { action: "REQUEST_FLEX"; weekMonday: string; leaveDate: string }
  | { action: "DECIDE_FLEX"; flexId: string; decision: "APPROVE" | "REJECT"; note?: string }
  | { action: "PROPOSE_POLICY"; employeeId: string; effectiveFrom: string; authorityReference: string }
  | { action: "DECIDE_POLICY"; policyId: string; decision: "APPROVE" | "REJECT" }
  | { action: "ISSUE_SLIP"; payrollResultId: string }
  | { action: "SUBMIT_SETTLEMENT"; payrollResultId: string; amountMinor: number; creditedAt: string; bankReference: string; evidenceReference: string }
  | { action: "DECIDE_SETTLEMENT"; settlementId: string; decision: "VERIFY" | "REJECT" },
) {
  const actor = await requireOfficeActor();
  const user = actor.identity.userId;
  let rpcName: string;
  let params: Record<string, unknown>;
  switch (input.action) {
    case "SUBMIT": {
      const start = Date.parse(input.startAt);
      const end = Date.parse(input.endAt);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end > Date.now() + 60_000) {
        throw new OfficeWorktimeError(400, "Work evidence must describe a completed, non-future interval");
      }
      if (input.sourceKind === "HISTORICAL_CORRECTION" && start < Date.parse("2026-07-31T18:30:00Z")) {
        throw new OfficeWorktimeError(400, "Historical attendance entry starts on 1 August 2026 (IST)");
      }
      rpcName = "office_worktime_submit";
      params = { p_actor: user, p_employee: input.employeeId || user, p_attendance: input.sessionId || null, p_start: input.startAt, p_end: input.endAt,
        p_breaks: input.breaks, p_source_kind: input.sourceKind, p_source_reference: input.sourceReference, p_reason: input.reason };
      break;
    }
    case "AMEND_PENDING": {
      const start = Date.parse(input.startAt);
      const end = Date.parse(input.endAt);
      if (!Number.isFinite(start) || !Number.isFinite(end) ||
          start < Date.parse("2026-07-31T18:30:00Z") ||
          start >= end || end > Date.now() + 60_000) {
        throw new OfficeWorktimeError(400, "Historical amendment must have completed times from 1 August 2026");
      }
      rpcName = "office_worktime_amend_pending";
      params = { p_actor: user, p_case: input.caseId, p_start: input.startAt,
        p_end: input.endAt, p_breaks: input.breaks,
        p_source_reference: input.sourceReference, p_reason: input.reason };
      break;
    }
    case "DECIDE":
      if (!actor.identity.roles.some(role => role === "OWNER" || role === "DIRECTOR") || !await can(actor, "people.update")) throw new OfficeWorktimeError(403, "Director People approval required");
      rpcName = "office_worktime_decide";
      params = { p_actor: user, p_case: input.caseId, p_decision: input.decision, p_note: input.note || null };
      break;
    case "REQUEST_FLEX":
      rpcName = "office_flex_day_request";
      params = { p_actor: user, p_week_monday: input.weekMonday, p_leave_date: input.leaveDate };
      break;
    case "DECIDE_FLEX":
      if (!actor.identity.roles.some(role => role === "OWNER" || role === "DIRECTOR") || !await can(actor, "people.update")) throw new OfficeWorktimeError(403, "Director People approval required");
      rpcName = "office_flex_day_decide";
      params = { p_actor: user, p_flex: input.flexId, p_decision: input.decision, p_note: input.note || null };
      break;
    case "PROPOSE_POLICY":
      if (!await can(actor, "payroll.rules.manage")) throw new OfficeWorktimeError(403, "Payroll policy permission required");
      rpcName = "office_worktime_policy_propose";
      params = { p_actor: user, p_employee: input.employeeId, p_effective: input.effectiveFrom, p_authority: input.authorityReference };
      break;
    case "DECIDE_POLICY":
      if (!await can(actor, "payroll.run.review")) throw new OfficeWorktimeError(403, "Independent Finance review required");
      rpcName = "office_worktime_policy_decide";
      params = { p_actor: user, p_policy: input.policyId, p_decision: input.decision };
      break;
    case "ISSUE_SLIP":
      if (!await can(actor, "payroll.run.review")) throw new OfficeWorktimeError(403, "Payroll review permission required");
      rpcName = "office_salary_slip_issue";
      params = { p_actor: user, p_result: input.payrollResultId };
      break;
    case "SUBMIT_SETTLEMENT":
      if (!await can(actor, "payroll.payment.prepare")) throw new OfficeWorktimeError(403, "Payment evidence preparation permission required");
      rpcName = "office_salary_settlement_submit";
      params = { p_actor: user, p_result: input.payrollResultId, p_amount: input.amountMinor, p_credited: input.creditedAt,
        p_masked_bank_ref: input.bankReference, p_evidence: input.evidenceReference };
      break;
    case "DECIDE_SETTLEMENT":
      if (!await can(actor, "payroll.run.review")) throw new OfficeWorktimeError(403, "Independent Finance review permission required");
      rpcName = "office_salary_settlement_decide";
      params = { p_actor: user, p_settlement: input.settlementId, p_decision: input.decision };
      break;
  }
  const { data, error } = await actor.admin.rpc(rpcName, params);
  if (error) throw new OfficeWorktimeError(409, error.message || "Worktime or payroll decision rejected");
  return { result: data };
}

/**
 * Read each source from protected Office tables and calculate server-side.
 * The result is imported as DRAFT earnings adjustments, not a final salary.
 * Existing separate payroll review must approve the adjustments afterwards.
 */
export async function importVerifiedWorktimePremiums(input: { periodId: string; employeeId: string }) {
  const actor = await requireOfficeActor();
  if (!await can(actor, "payroll.run.prepare")) throw new OfficeWorktimeError(403, "Payroll preparation permission required");
  const period = await actor.admin.from("office_payroll_periods").select("id,starts_on,ends_on,status,period_kind").eq("id", input.periodId).maybeSingle();
  check(period, "Payroll period is unavailable");
  if (!period.data || period.data.period_kind !== "MONTHLY" || !["DRAFT","ATTENDANCE_READY","CALCULATED"].includes(period.data.status)) {
    throw new OfficeWorktimeError(409, "Only editable monthly payroll periods can import verified time");
  }
  const month = period.data.starts_on.slice(0, 7);
  const range = monthRange(month);
  if (period.data.starts_on !== range.first || period.data.ends_on !== range.last) {
    throw new OfficeWorktimeError(409, "Payroll period must match complete calendar month");
  }
  const state = await officeWorktimeOverview({ month, employeeUserId: input.employeeId });
  if (!state.preview || !state.approved_policy || state.preview.warnings.length) {
    throw new OfficeWorktimeError(409, "Approved policy, verified attendance and working-time compliance are required");
  }
  const employment = await actor.admin.from("office_employment_registry").select("employment_id").eq("identity_user_id", input.employeeId).in("status", ["ACTIVE","ON_LEAVE"]).limit(1);
  check(employment, "Employment record unavailable");
  const employmentId = employment.data?.[0]?.employment_id;
  if (!employmentId) throw new OfficeWorktimeError(409, "Active employment record required");
  const approved = state.preview;
  const digest = createHash("sha256").update(JSON.stringify({
    month, employeeId: input.employeeId, sourceIds: approved.sourceSessionIds.sort(),
    authority: approved.authorityReference, amounts: [approved.weekdayOvertimeMinor,approved.weekendPremiumMinor,approved.nightPremiumMinor],
  })).digest("hex");
  const reference = "WORKTIME:" + digest;
  const rows: Array<{ code: string; label: string; amount: number }> = [
    { code: "WORKTIME_WEEKDAY_OT", label: "Approved weekday overtime (2x)", amount: approved.weekdayOvertimeMinor },
    { code: "WORKTIME_WEEKEND", label: "Approved Saturday/Sunday work (3x)", amount: approved.weekendPremiumMinor },
    { code: "WORKTIME_NIGHT", label: "Approved night-work premium", amount: approved.nightPremiumMinor },
  ].filter(row => row.amount > 0);
  const imported: string[] = [];
  for (const row of rows) {
    const existing = await actor.admin.from("office_payroll_adjustments")
      .select("id").eq("period_id", input.periodId).eq("employment_id", employmentId)
      .eq("adjustment_code", row.code).eq("source_reference", reference).maybeSingle();
    check(existing, "Existing adjustment check unavailable");
    if (existing.data) { imported.push(existing.data.id); continue; }
    const result = await actor.admin.rpc("office_payroll_add_adjustment", {
      p_actor: actor.identity.userId, p_period: input.periodId, p_employment: employmentId,
      p_kind: "EARNING", p_code: row.code, p_label: row.label, p_amount: row.amount,
      p_currency: "INR", p_source: reference, p_note: "Independently reviewed worktime; separate payroll approval still required",
    });
    if (result.error || typeof result.data !== "string") throw new OfficeWorktimeError(409, result.error?.message || "Unable to prepare worktime adjustment");
    imported.push(result.data);
  }
  return { adjustment_ids: imported, amounts: rows, total_minor: approved.totalAdditionalEarningsMinor,
    source_reference: reference, status: "DRAFT_ADJUSTMENTS_NEED_INDEPENDENT_REVIEW" };
}

/**
 * Creates or intentionally revises a reviewable monthly payroll attendance
 * snapshot from independently approved worktime. Unverified scheduled hours
 * remain unresolved; neither absence nor deduction is inferred.
 */
export async function prepareVerifiedHoursPayroll(input: {
  periodId: string;
  employeeId: string;
  replaceExisting?: boolean;
  expectedUpdatedAt?: string;
  reason?: string;
}) {
  const current = await requireOfficeActor();
  if (!await can(current, "payroll.run.prepare")) {
    throw new OfficeWorktimeError(403, "Payroll preparation permission required");
  }
  const period = await current.admin.from("office_payroll_periods")
    .select("id,starts_on,ends_on,status,period_kind").eq("id", input.periodId).maybeSingle();
  check(period, "Payroll period unavailable");
  if (!period.data || period.data.period_kind !== "MONTHLY" ||
      !["DRAFT","ATTENDANCE_READY","CALCULATED"].includes(period.data.status)) {
    throw new OfficeWorktimeError(409, "Payroll period is not editable");
  }
  const month = period.data.starts_on.slice(0, 7);
  const range = monthRange(month);
  if (range.first !== period.data.starts_on || range.last !== period.data.ends_on) {
    throw new OfficeWorktimeError(409, "Only complete calendar months support automatic verified hours");
  }
  const state = await officeWorktimeOverview({ month, employeeUserId: input.employeeId });
  if (!state.approved_monthly_gross_minor || state.approved_gross_currency !== "INR") {
    throw new OfficeWorktimeError(409, "An approved INR compensation version is required");
  }
  if (state.claims.some(claim => claim.status === "PENDING")) {
    throw new OfficeWorktimeError(409, "Resolve pending attendance corrections before payroll preparation");
  }
  const employment = await current.admin.from("office_employment_registry")
    .select("employment_id,identity_user_id,status,start_date,end_date")
    .eq("identity_user_id", input.employeeId).in("status", ["ACTIVE","ON_LEAVE"]).limit(2);
  check(employment, "Employment record unavailable");
  if (employment.data?.length !== 1) {
    throw new OfficeWorktimeError(409, "Exactly one active employment record is required");
  }
  const record = employment.data[0];
  if ((record.start_date && record.start_date > range.first) ||
      (record.end_date && record.end_date < range.last)) {
    throw new OfficeWorktimeError(409, "Partial-month employment requires reviewed manual proration");
  }
  const previous = await current.admin.from("office_payroll_attendance_snapshots")
    .select("id,updated_at,basis_units,payable_units,paid_leave_units,unpaid_leave_units,absence_units,unresolved_units")
    .eq("period_id", input.periodId).eq("employment_id", record.employment_id).maybeSingle();
  check(previous, "Existing payroll attendance snapshot unavailable");
  if (previous.data && !input.replaceExisting) {
    throw new OfficeWorktimeError(409, "An attendance snapshot already exists. Explicitly Update with a correction reason or edit in Payroll OS");
  }
  if (previous.data && (!input.reason || input.reason.trim().length < 12)) {
    throw new OfficeWorktimeError(400, "An evidence-backed correction reason is required to update recorded payroll hours");
  }
  if (previous.data && input.expectedUpdatedAt && previous.data.updated_at !== input.expectedUpdatedAt) {
    throw new OfficeWorktimeError(409, "Payroll attendance changed since the form was opened. Refresh and retry");
  }
  const estimate = state.salary_preview;
  const basis = Number((estimate.basisMinutes / 60).toFixed(3));
  const regular = Number((estimate.approvedRegularMinutes / 60).toFixed(3));
  const unresolved = Number(Math.max(0, basis - regular).toFixed(3));
  const audit = {
    source: "INDEPENDENTLY_APPROVED_WORKTIME", month,
    source_case_ids: estimate.sourceSessionIds,
    verified_regular_minutes: estimate.approvedRegularMinutes,
    outstanding_minutes: estimate.unresolvedMinutes,
    potential_weekday_overtime_minutes: estimate.potentialWeekdayOvertimeMinutes,
    optional_weekend_minutes: estimate.optionalWeekendMinutes,
    calculation_note: "Unverified time is unresolved, not automatically unpaid. Leave/holiday evidence must be reviewed in Payroll OS.",
    update_reason: input.reason?.trim() || null,
    replaced_snapshot: previous.data || null,
  };
  const result = await setPayrollAttendance({
    periodId: input.periodId, employmentId: record.employment_id,
    basisUnits: basis, payableUnits: regular, paidLeaveUnits: 0,
    unpaidLeaveUnits: 0, absenceUnits: 0, unresolvedUnits: unresolved,
    sourceSnapshot: audit,
    expectedUpdatedAt: previous.data?.updated_at,
    correctionReason: previous.data ? input.reason : undefined,
  });
  return {
    ...result, employee_user_id: input.employeeId, period_id: input.periodId,
    scheduled_hours: basis, verified_regular_hours: regular, unresolved_hours: unresolved,
    potential_weekday_overtime_hours: Number((estimate.potentialWeekdayOvertimeMinutes / 60).toFixed(3)),
    estimated_regular_gross_minor: estimate.estimatedRegularGrossMinor,
    review_required: unresolved > 0, bank_execution: false,
  };
}
