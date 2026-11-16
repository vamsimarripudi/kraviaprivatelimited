import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { deriveHrReadiness, type HrReadinessMetrics, type HrReadinessSnapshot } from "@/lib/office/hr-readiness";

export class HrReadinessError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HrReadinessError";
  }
}

type Condition =
  | { kind: "eq"; column: string; value: string | boolean }
  | { kind: "lt"; column: string; value: string }
  | { kind: "lte"; column: string; value: string }
  | { kind: "null"; column: string }
  | { kind: "not-null"; column: string };

async function countRows(admin: SupabaseClient, table: string, conditions: Condition[] = []): Promise<number> {
  // Counts only. No personally identifiable, banking, attendance interval or
  // remuneration rows may be sent to the client from this endpoint.
  let query = admin.from(table).select("*", { count: "exact", head: true });
  for (const condition of conditions) {
    if (condition.kind === "eq") query = query.eq(condition.column, condition.value);
    else if (condition.kind === "lt") query = query.lt(condition.column, condition.value);
    else if (condition.kind === "lte") query = query.lte(condition.column, condition.value);
    else if (condition.kind === "null") query = query.is(condition.column, null);
    else query = query.not(condition.column, "is", null);
  }
  const result = await query;
  if (result.error || typeof result.count !== "number") {
    throw new HrReadinessError(503, "HR readiness records are temporarily unavailable");
  }
  return result.count;
}

function todayInIst(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

export async function getOfficeHrReadiness(): Promise<HrReadinessSnapshot> {
  const { admin, identity } = await requireOfficeActor();
  if (!identity.roles.some(role => role === "OWNER" || role === "DIRECTOR" || role === "HR")) {
    throw new OfficePermissionError(403, "HR role is required");
  }
  const can = async (permission: string) =>
    (await resolveOfficePermission(admin, identity, permission, { type: "COMPANY" })).allowed;
  const [canReadPeople, canReadCompensation, canReadRules, canReadRun, canReadDevices, canApproveDevices] =
    await Promise.all([
      can("people.basic.read"), can("payroll.compensation.read"), can("payroll.rules.read"),
      can("payroll.run.read"), can("device.posture.read"), can("access.device.approve"),
    ]);
  if (!canReadPeople) throw new OfficePermissionError(403, "Company-wide HR read authority is required");
  const today = todayInIst();

  const [
    activeEmployees, plannedEmployees, activeMissingStartDates,
    draftIntakes, verifiedIntakes, verifiedBankAccounts, issuedEmployeeIds,
    attendanceSessions, openAttendanceSessions, overdueOpenSessions,
    pendingWorktimeReviews, pendingLeaveRequests, historicImportBatches,
    sourceReadyMailEvents, enabledMailEvents, employeeIdMailPolicies,
  ] = await Promise.all([
    countRows(admin, "office_employment_registry", [{ kind: "eq", column: "status", value: "ACTIVE" }]),
    countRows(admin, "office_employment_registry", [{ kind: "eq", column: "status", value: "PLANNED" }]),
    countRows(admin, "office_employment_registry", [{ kind: "eq", column: "status", value: "ACTIVE" }, { kind: "null", column: "start_date" }]),
    countRows(admin, "office_employee_intake_profiles", [{ kind: "eq", column: "status", value: "DRAFT" }]),
    countRows(admin, "office_employee_intake_profiles", [{ kind: "eq", column: "status", value: "VERIFIED" }]),
    countRows(admin, "office_employee_intake_profiles", [{ kind: "not-null", column: "bank_verified_at" }]),
    countRows(admin, "office_employee_reference_ids"),
    countRows(admin, "office_attendance_sessions"),
    countRows(admin, "office_attendance_sessions", [{ kind: "eq", column: "status", value: "OPEN" }]),
    countRows(admin, "office_attendance_sessions", [{ kind: "eq", column: "status", value: "OPEN" }, { kind: "lt", column: "work_date", value: today }]),
    countRows(admin, "office_worktime_review_cases", [{ kind: "eq", column: "status", value: "PENDING" }]),
    countRows(admin, "office_hr_leave_requests", [{ kind: "eq", column: "status", value: "PENDING" }]),
    countRows(admin, "office_hr_attendance_import_batches"),
    countRows(admin, "office_lifecycle_mail_policy", [{ kind: "eq", column: "source_ready", value: true }]),
    countRows(admin, "office_lifecycle_mail_policy", [{ kind: "eq", column: "enabled", value: true }]),
    countRows(admin, "office_employee_mail_delivery_policy", [
      { kind: "eq", column: "key", value: "EMPLOYEE_ID_ISSUED" },
      { kind: "eq", column: "enabled", value: true },
      { kind: "not-null", column: "approved_at" },
    ]),
  ]);

  // Different HR scopes must not be promoted by this dashboard. Null means
  // restricted/unverified rather than a fabricated 'zero' readiness indicator.
  const [approvedCompensationVersions, approvedPayrollRules, approvedWorktimePolicies, payrollPeriods, issuedPayslips, trustedManagedDevices] =
    await Promise.all([
      canReadCompensation ? countRows(admin, "office_compensation_versions", [
        { kind: "eq", column: "status", value: "APPROVED" },
        { kind: "lte", column: "effective_from", value: today },
      ]) : Promise.resolve(null),
      canReadRules ? countRows(admin, "office_payroll_rule_versions", [
        { kind: "eq", column: "status", value: "APPROVED" },
        { kind: "lte", column: "effective_from", value: today },
      ]) : Promise.resolve(null),
      canReadRules ? countRows(admin, "office_worktime_policy_versions", [
        { kind: "eq", column: "status", value: "APPROVED" },
        { kind: "lte", column: "effective_from", value: today },
      ]) : Promise.resolve(null),
      canReadRun ? countRows(admin, "office_payroll_periods") : Promise.resolve(null),
      canReadRun ? countRows(admin, "office_salary_payslip_issues") : Promise.resolve(null),
      canReadDevices || canApproveDevices ? countRows(admin, "office_device_registry", [
        { kind: "eq", column: "company_managed", value: true },
        { kind: "eq", column: "trust_state", value: "TRUSTED" },
        { kind: "null", column: "revoked_at" },
      ]) : Promise.resolve(null),
    ]);

  const metrics: HrReadinessMetrics = {
    activeEmployees, plannedEmployees, activeMissingStartDates,
    draftIntakes, verifiedIntakes, verifiedBankAccounts, issuedEmployeeIds,
    attendanceSessions, openAttendanceSessions, overdueOpenSessions,
    pendingWorktimeReviews, pendingLeaveRequests, historicImportBatches,
    approvedCompensationVersions, approvedPayrollRules, approvedWorktimePolicies,
    payrollPeriods, issuedPayslips, trustedManagedDevices,
    sourceReadyMailEvents, enabledMailEvents,
    employeeIdMailEnabled: employeeIdMailPolicies > 0,
  };
  return {
    generatedAt: new Date().toISOString(),
    metrics,
    actions: deriveHrReadiness(metrics),
    notice: "Evidence-based HR operations snapshot. This is not a certified employment register, legal determination, approved salary, payroll batch, or payment confirmation. Restricted counts are shown as unavailable.",
  };
}
