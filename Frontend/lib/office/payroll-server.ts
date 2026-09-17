import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
} from "@/lib/office/permission-engine";

export class OfficePayrollError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficePayrollError";
  }
}

type Actor = Awaited<ReturnType<typeof requireOfficeActor>>;

async function actor(): Promise<Actor> {
  try { return await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficePayrollError(error.status, error.message);
    throw error;
  }
}

async function allowed(current: Actor, permission: string) {
  return (await resolveOfficePermission(current.admin, current.identity, permission, { type: "COMPANY" })).allowed;
}

async function requirePermission(permission: string) {
  const current = await actor();
  if (!await allowed(current, permission)) throw new OfficePayrollError(403, `${permission} permission is required`);
  return current;
}

function fail(error: { message?: string } | null, message: string) {
  if (error) throw new OfficePayrollError(503, message);
}

export async function getOfficePayrollOverview() {
  const current = await actor();
  const [canReadRun, canReadCompensation, canReadRules, canManageCompensation, canManageRules, canPrepare, canReview, canPreparePayment] = await Promise.all([
    allowed(current, "payroll.run.read"),
    allowed(current, "payroll.compensation.read"),
    allowed(current, "payroll.rules.read"),
    allowed(current, "payroll.compensation.manage"),
    allowed(current, "payroll.rules.manage"),
    allowed(current, "payroll.run.prepare"),
    allowed(current, "payroll.run.review"),
    allowed(current, "payroll.payment.prepare"),
  ]);
  if (!canReadRun && !canReadCompensation && !canReadRules) throw new OfficePayrollError(403, "Payroll read permission is required");

  const [employment, identities, jobs, periods, rules, compensation, snapshots, adjustments, results, batches, entries] = await Promise.all([
    current.admin.from("office_employment_registry").select("employment_id,employment_code,identity_user_id,relationship_type,status,start_date,end_date,end_reason").in("status", ["PLANNED", "ACTIVE", "ON_LEAVE", "ENDED"]).order("employment_code"),
    current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").order("display_name"),
    current.admin.from("office_job_assignments").select("user_id,position_code,department_code,reports_to_user_id,status,start_date,end_date").in("status", ["PLANNED", "ACTIVE", "ON_LEAVE", "ENDED"]),
    canReadRun ? current.admin.from("office_payroll_periods").select("id,period_code,period_kind,starts_on,ends_on,attendance_cutoff_at,pay_date,status,approval_request_id,calculation_version,approved_by,approved_at,created_at,updated_at").order("starts_on", { ascending: false }).limit(36) : Promise.resolve({ data: [], error: null }),
    canReadRules ? current.admin.from("office_payroll_rule_versions").select("id,rule_code,version,rule_kind,title,jurisdiction,effective_from,effective_to,configuration,source_reference,status,created_by,approved_by,approved_at,created_at,updated_at").order("rule_code").order("version", { ascending: false }).limit(300) : Promise.resolve({ data: [], error: null }),
    canReadCompensation ? current.admin.from("office_compensation_versions").select("id,compensation_code,employment_id,employee_user_id,grade_code,annual_ctc_minor,monthly_gross_minor,currency,components,effective_from,effective_to,reason,status,approval_request_id,created_by,approved_by,approved_at,created_at,updated_at").order("effective_from", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    canReadRun ? current.admin.from("office_payroll_attendance_snapshots").select("id,period_id,employment_id,employee_user_id,basis_units,payable_units,paid_leave_units,unpaid_leave_units,absence_units,unresolved_units,source_snapshot,status,prepared_by,reviewed_by,reviewed_at,updated_at").order("updated_at", { ascending: false }).limit(1200) : Promise.resolve({ data: [], error: null }),
    canReadRun ? current.admin.from("office_payroll_adjustments").select("id,period_id,employment_id,employee_user_id,adjustment_kind,adjustment_code,label,amount_minor,currency,source_reference,note,status,created_by,approved_by,approved_at,created_at,updated_at").order("created_at", { ascending: false }).limit(1200) : Promise.resolve({ data: [], error: null }),
    canReadRun ? current.admin.from("office_payroll_results").select("id,period_id,employment_id,employee_user_id,compensation_version_id,currency,base_gross_minor,prorated_gross_minor,additional_earnings_minor,deductions_minor,employer_costs_minor,net_pay_minor,line_items,calculation_hash,calculation_version,status,calculated_at").order("calculated_at", { ascending: false }).limit(1200) : Promise.resolve({ data: [], error: null }),
    canReadRun ? current.admin.from("office_salary_payment_batches").select("id,batch_code,period_id,currency,total_minor,employee_count,status,provider,provider_batch_reference,prepared_by,submitted_by,submitted_at,created_at,updated_at").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    canReadRun ? current.admin.from("office_salary_payment_entries").select("id,batch_id,payroll_result_id,employment_id,employee_user_id,amount_minor,currency,destination_reference,destination_masked,status,provider_reference,failure_reason,updated_at").order("updated_at", { ascending: false }).limit(1600) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [employment, identities, jobs, periods, rules, compensation, snapshots, adjustments, results, batches, entries]) fail(result.error, "Payroll data is temporarily unavailable");

  const requestIds = Array.from(new Set([
    ...(periods.data ?? []).map((row) => row.approval_request_id),
    ...(compensation.data ?? []).map((row) => row.approval_request_id),
  ].filter((value): value is string => typeof value === "string" && Boolean(value))));
  const approvals = requestIds.length
    ? await current.admin.from("office_requests").select("id,request_type_code,title,status,current_step_order,due_at,submitted_at,completed_at,updated_at").in("id", requestIds)
    : { data: [], error: null };
  fail(approvals.error, "Payroll approval state is temporarily unavailable");

  const ownerRole = current.identity.roles.includes("OWNER");
  return {
    actor: { user_id: current.identity.userId, roles: current.identity.roles, department: current.identity.department ?? null },
    capabilities: {
      read_run: canReadRun,
      read_compensation: canReadCompensation,
      read_rules: canReadRules,
      manage_compensation: canManageCompensation,
      manage_rules: canManageRules,
      prepare_run: canPrepare,
      review_run: canReview,
      approve_rules: ownerRole,
      prepare_payment: canPreparePayment,
    },
    employment: employment.data ?? [],
    identities: identities.data ?? [],
    jobs: jobs.data ?? [],
    periods: periods.data ?? [],
    rules: rules.data ?? [],
    compensation: compensation.data ?? [],
    attendance: snapshots.data ?? [],
    adjustments: adjustments.data ?? [],
    results: results.data ?? [],
    batches: batches.data ?? [],
    entries: entries.data ?? [],
    approvals: approvals.data ?? [],
    disclaimer: "Payroll calculations use approved compensation, reviewed attendance snapshots and approved adjustments only. No statutory tax or contribution rate is hard-coded in this workspace, and salary batches do not execute bank transfers by themselves.",
  };
}

export async function createCompensationDraft(input: { employmentId: string; grade?: string; annualCtcMinor: number; monthlyGrossMinor: number; currency: string; components?: unknown[]; effectiveFrom: string; reason: string }) {
  const current = await requirePermission("payroll.compensation.manage");
  const { data, error } = await current.admin.rpc("office_compensation_create_draft", {
    p_actor: current.identity.userId,
    p_employment: input.employmentId,
    p_grade: input.grade?.trim() || null,
    p_annual_ctc: input.annualCtcMinor,
    p_monthly_gross: input.monthlyGrossMinor,
    p_currency: input.currency,
    p_components: input.components ?? [],
    p_effective_from: input.effectiveFrom,
    p_reason: input.reason,
  });
  if (error || typeof data !== "string") throw new OfficePayrollError(400, error?.message ?? "Unable to create compensation draft");
  return { compensation_id: data };
}

export async function submitCompensation(compensationId: string) {
  const current = await requirePermission("payroll.compensation.manage");
  const { data, error } = await current.admin.rpc("office_compensation_submit", { p_actor: current.identity.userId, p_compensation: compensationId });
  if (error || typeof data !== "string") throw new OfficePayrollError(400, error?.message ?? "Unable to submit compensation change");
  return { approval_request_id: data };
}

export async function syncCompensationApproval(compensationId: string) {
  const current = await actor();
  if (!await allowed(current, "payroll.compensation.read") && !await allowed(current, "payroll.compensation.manage")) throw new OfficePayrollError(403, "Compensation permission is required");
  const { data, error } = await current.admin.rpc("office_compensation_sync_approval", { p_actor: current.identity.userId, p_compensation: compensationId });
  if (error || typeof data !== "string") throw new OfficePayrollError(400, error?.message ?? "Unable to synchronize compensation approval");
  return { status: data };
}

export async function createPayrollRule(input: { ruleCode: string; kind: string; title: string; jurisdiction: string; effectiveFrom: string; effectiveTo?: string; configuration: Record<string, unknown>; sourceReference: string }) {
  const current = await requirePermission("payroll.rules.manage");
  const { data, error } = await current.admin.rpc("office_payroll_rule_create", {
    p_actor: current.identity.userId,
    p_rule_code: input.ruleCode,
    p_kind: input.kind,
    p_title: input.title,
    p_jurisdiction: input.jurisdiction,
    p_effective_from: input.effectiveFrom,
    p_effective_to: input.effectiveTo ?? null,
    p_configuration: input.configuration,
    p_source_reference: input.sourceReference,
  });
  if (error || typeof data !== "string") throw new OfficePayrollError(400, error?.message ?? "Unable to create payroll rule version");
  return { rule_id: data };
}

export async function reviewPayrollRule(input: { ruleId: string; decision: "APPROVE" | "REJECT"; note?: string }) {
  const current = await actor();
  if (!current.identity.roles.includes("OWNER")) throw new OfficePayrollError(403, "OWNER authority is required to approve payroll rules");
  const { data, error } = await current.admin.rpc("office_payroll_rule_approve", { p_actor: current.identity.userId, p_rule: input.ruleId, p_decision: input.decision, p_note: input.note?.trim() || null });
  if (error || typeof data !== "string") throw new OfficePayrollError(400, error?.message ?? "Unable to review payroll rule");
  return { status: data };
}

export async function openPayrollPeriod(input: { kind: "MONTHLY" | "OFF_CYCLE" | "FINAL_SETTLEMENT"; startsOn: string; endsOn: string; attendanceCutoffAt?: string; payDate?: string }) {
  const current = await requirePermission("payroll.run.prepare");
  const { data, error } = await current.admin.rpc("office_payroll_open_period", { p_actor: current.identity.userId, p_kind: input.kind, p_start: input.startsOn, p_end: input.endsOn, p_cutoff: input.attendanceCutoffAt ?? null, p_pay_date: input.payDate ?? null });
  if (error || typeof data !== "string") throw new OfficePayrollError(400, error?.message ?? "Unable to open payroll period");
  return { period_id: data };
}

export async function setPayrollAttendance(input: { periodId: string; employmentId: string; basisUnits: number; payableUnits: number; paidLeaveUnits?: number; unpaidLeaveUnits?: number; absenceUnits?: number; unresolvedUnits?: number; sourceSnapshot?: Record<string, unknown> }) {
  const current = await requirePermission("payroll.run.prepare");
  const { data, error } = await current.admin.rpc("office_payroll_set_attendance_snapshot", {
    p_actor: current.identity.userId, p_period: input.periodId, p_employment: input.employmentId,
    p_basis: input.basisUnits, p_payable: input.payableUnits, p_paid_leave: input.paidLeaveUnits ?? 0,
    p_unpaid_leave: input.unpaidLeaveUnits ?? 0, p_absence: input.absenceUnits ?? 0,
    p_unresolved: input.unresolvedUnits ?? 0, p_source: input.sourceSnapshot ?? {},
  });
  if (error || typeof data !== "string") throw new OfficePayrollError(400, error?.message ?? "Unable to record payroll attendance snapshot");
  return { attendance_snapshot_id: data };
}

export async function addPayrollAdjustment(input: { periodId: string; employmentId: string; kind: "EARNING" | "DEDUCTION" | "EMPLOYER_COST"; code: string; label: string; amountMinor: number; currency: string; sourceReference: string; note?: string }) {
  const current = await requirePermission("payroll.run.prepare");
  const { data, error } = await current.admin.rpc("office_payroll_add_adjustment", {
    p_actor: current.identity.userId, p_period: input.periodId, p_employment: input.employmentId,
    p_kind: input.kind, p_code: input.code, p_label: input.label, p_amount: input.amountMinor,
    p_currency: input.currency, p_source: input.sourceReference, p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficePayrollError(400, error?.message ?? "Unable to create payroll adjustment");
  return { adjustment_id: data };
}

export async function reviewPayrollAdjustment(input: { adjustmentId: string; decision: "APPROVE" | "REJECT" }) {
  const current = await requirePermission("payroll.run.review");
  const { data, error } = await current.admin.rpc("office_payroll_review_adjustment", { p_actor: current.identity.userId, p_adjustment: input.adjustmentId, p_decision: input.decision });
  if (error || typeof data !== "string") throw new OfficePayrollError(400, error?.message ?? "Unable to review payroll adjustment");
  return { status: data };
}

export async function calculatePayroll(periodId: string) {
  const current = await requirePermission("payroll.run.prepare");
  const { data, error } = await current.admin.rpc("office_payroll_calculate", { p_actor: current.identity.userId, p_period: periodId });
  if (error || typeof data !== "number") throw new OfficePayrollError(400, error?.message ?? "Unable to calculate payroll");
  return { employee_count: data };
}

export async function submitPayroll(periodId: string) {
  const current = await requirePermission("payroll.run.prepare");
  const { data, error } = await current.admin.rpc("office_payroll_submit", { p_actor: current.identity.userId, p_period: periodId });
  if (error || typeof data !== "string") throw new OfficePayrollError(400, error?.message ?? "Unable to submit payroll approval");
  return { approval_request_id: data };
}

export async function syncPayrollApproval(periodId: string) {
  const current = await requirePermission("payroll.run.read");
  const { data, error } = await current.admin.rpc("office_payroll_sync_approval", { p_actor: current.identity.userId, p_period: periodId });
  if (error || typeof data !== "string") throw new OfficePayrollError(400, error?.message ?? "Unable to synchronize payroll approval");
  return { status: data };
}

export async function prepareSalaryBatch(periodId: string) {
  const current = await requirePermission("payroll.payment.prepare");
  const { data, error } = await current.admin.rpc("office_payroll_prepare_payment_batch", { p_actor: current.identity.userId, p_period: periodId });
  if (error || typeof data !== "string") throw new OfficePayrollError(400, error?.message ?? "Unable to prepare salary batch");
  return { batch_id: data, bank_execution: false };
}
