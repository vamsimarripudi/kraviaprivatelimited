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
  | { kind: "not-null"; column: string }
  | { kind: "in"; column: string; values: string[] };

async function countRows(admin: SupabaseClient, table: string, conditions: Condition[] = []): Promise<number> {
  // Counts only. No personally identifiable, banking, attendance interval or
  // remuneration rows may be sent to the client from this endpoint.
  let query = admin.from(table).select("*", { count: "exact", head: true });
  for (const condition of conditions) {
    if (condition.kind === "eq") query = query.eq(condition.column, condition.value);
    else if (condition.kind === "lt") query = query.lt(condition.column, condition.value);
    else if (condition.kind === "lte") query = query.lte(condition.column, condition.value);
    else if (condition.kind === "null") query = query.is(condition.column, null);
    else if (condition.kind === "in") query = query.in(condition.column, condition.values);
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


type EmploymentReference = { employment_id: string; identity_user_id: string | null; start_date: string | null };

/** Page internally: Supabase's configured max-rows must not truncate salary coverage. */
async function currentActiveEmployment(admin: SupabaseClient): Promise<EmploymentReference[]> {
  const rows: EmploymentReference[] = [];
  for (let offset = 0; offset < 100000; offset += 500) {
    const { data, error } = await admin.from("office_employment_registry")
      .select("employment_id,identity_user_id,start_date")
      .eq("status", "ACTIVE").order("employment_id").range(offset, offset + 499);
    if (error || !data) throw new HrReadinessError(503, "Active employment register is unavailable");
    rows.push(...(data as EmploymentReference[]));
    if (data.length < 500) return rows;
  }
  throw new HrReadinessError(503, "HR register exceeds safe completeness limit");
}

/** Count *distinct active employees*, never obsolete versions or planned employees. */
async function currentActiveCoverage(
  admin: SupabaseClient, table: string, column: string, activeIds: string[],
  today: string, hasEndDate: boolean,
): Promise<number> {
  if (activeIds.length === 0) return 0;
  const covered = new Set<string>();
  // Chunk filters and page results. All returned identifiers remain server-side.
  for (let i = 0; i < activeIds.length; i += 100) {
    const batch = activeIds.slice(i, i + 100);
    for (let offset = 0; offset < 100000; offset += 500) {
      let query = admin.from(table).select(column).in(column, batch)
        .eq("status", "APPROVED").lte("effective_from", today)
        .order(column).range(offset, offset + 499);
      if (hasEndDate) query = query.or("effective_to.is.null,effective_to.gte." + today);
      const { data, error } = await query;
      if (error || !data) throw new HrReadinessError(503, "Approved HR policy coverage is unavailable");
      for (const row of data as unknown as Array<Record<string, unknown>>) {
        const id = row[column];
        if (typeof id === "string" && batch.includes(id)) covered.add(id);
      }
      if (data.length < 500) break;
      if (offset >= 99500) throw new HrReadinessError(503, "HR coverage exceeds safe completeness limit");
    }
  }
  return covered.size;
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

  const activeRefs = await currentActiveEmployment(admin);
  const activeEmployees = activeRefs.length;
  const activeMissingStartDates = activeRefs.filter(row => !row.start_date).length;
  const activeEmploymentIds = activeRefs.map(row => row.employment_id);
  const activeUserIds = [...new Set(activeRefs.map(row => row.identity_user_id).filter((id): id is string => Boolean(id)))];

  const [
    plannedEmployees, draftIntakes, verifiedIntakes, verifiedBankAccounts, issuedEmployeeIds,
    attendanceSessions, openAttendanceSessions, overdueOpenSessions, pendingWorktimeReviews,
    pendingLeaveRequests, historicImportBatches, sourceReadyMailEvents,
    enabledMailEvents, employeeIdMailPolicies,
  ] = await Promise.all([
    countRows(admin, "office_employment_registry", [{ kind: "eq", column: "status", value: "PLANNED" }]),
    countRows(admin, "office_employee_intake_profiles", [{ kind: "eq", column: "status", value: "DRAFT" }]),
    activeUserIds.length ? countRows(admin, "office_employee_intake_profiles", [
      { kind: "eq", column: "status", value: "VERIFIED" }, { kind: "in", column: "employee_user_id", values: activeUserIds },
    ]) : Promise.resolve(0),
    activeUserIds.length ? countRows(admin, "office_employee_intake_profiles", [
      { kind: "not-null", column: "bank_verified_at" }, { kind: "in", column: "employee_user_id", values: activeUserIds },
    ]) : Promise.resolve(0),
    activeUserIds.length ? countRows(admin, "office_employee_reference_ids", [
      { kind: "in", column: "employee_user_id", values: activeUserIds },
    ]) : Promise.resolve(0),
    countRows(admin, "office_attendance_sessions"),
    countRows(admin, "office_attendance_sessions", [{ kind: "eq", column: "status", value: "OPEN" }]),
    countRows(admin, "office_attendance_sessions", [
      { kind: "eq", column: "status", value: "OPEN" }, { kind: "lt", column: "work_date", value: today },
    ]),
    countRows(admin, "office_worktime_review_cases", [{ kind: "eq", column: "status", value: "PENDING" }]),
    countRows(admin, "office_hr_leave_requests", [{ kind: "eq", column: "status", value: "PENDING" }]),
    countRows(admin, "office_hr_attendance_import_batches"),
    countRows(admin, "office_lifecycle_mail_policy", [{ kind: "eq", column: "source_ready", value: true }]),
    countRows(admin, "office_lifecycle_mail_policy", [{ kind: "eq", column: "enabled", value: true }]),
    countRows(admin, "office_employee_mail_delivery_policy", [
      { kind: "eq", column: "key", value: "EMPLOYEE_ID_ISSUED" },
      { kind: "eq", column: "enabled", value: true },
      { kind: "not-null", column: "approved_at" },
      { kind: "lte", column: "effective_from", value: new Date().toISOString() },
    ]),
  ]);

  // Null means restricted/unverified, not an invented zero. Bank details and
  // source employment identifiers are never serialized into the response.
  const [approvedCompensationVersions, approvedPayrollRules, approvedWorktimePolicies, payrollPeriods, issuedPayslips, trustedManagedDevices] =
    await Promise.all([
      canReadCompensation ? currentActiveCoverage(
        admin, "office_compensation_versions", "employment_id", activeEmploymentIds, today, true,
      ) : Promise.resolve(null),
      canReadRules ? countRows(admin, "office_payroll_rule_versions", [
        { kind: "eq", column: "status", value: "APPROVED" },
        { kind: "lte", column: "effective_from", value: today },
      ]) : Promise.resolve(null),
      canReadRules ? currentActiveCoverage(
        admin, "office_worktime_policy_versions", "employee_user_id", activeUserIds, today, false,
      ) : Promise.resolve(null),
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
