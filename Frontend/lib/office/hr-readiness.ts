/**
 * HR readiness is an evidence queue, not a compliance certificate or a wage
 * calculator. Only aggregate counts may cross this boundary.
 */
export type HrPriority = "P0" | "P1" | "P2";

export type HrReadinessMetrics = {
  activeEmployees: number;
  plannedEmployees: number;
  activeMissingStartDates: number;
  draftIntakes: number;
  verifiedIntakes: number;
  verifiedBankAccounts: number;
  issuedEmployeeIds: number;
  attendanceSessions: number;
  openAttendanceSessions: number;
  overdueOpenSessions: number;
  pendingWorktimeReviews: number;
  pendingLeaveRequests: number;
  historicImportBatches: number;
  approvedCompensationVersions: number | null;
  approvedPayrollRules: number | null;
  approvedWorktimePolicies: number | null;
  payrollPeriods: number | null;
  issuedPayslips: number | null;
  trustedManagedDevices: number | null;
  sourceReadyMailEvents: number;
  enabledMailEvents: number;
  employeeIdMailEnabled: boolean;
};

export type HrReadinessAction = {
  id: string;
  priority: HrPriority;
  title: string;
  detail: string;
  href: "/office/people" | "/office/my-role" | "/office/worktime" |
    "/office/payroll" | "/office/approvals" | "/office/devices" |
    "/office/notifications" | "/office/settings" | "/office/governance" | "/office/recruitment" |
    "/office/people#hr-employee-intake" | "/office/people#hr-attendance-import";
  action: string;
  requiresHumanEvidence?: boolean;
  ownerOnly?: boolean;
};

export type HrReadinessSnapshot = {
  generatedAt: string;
  metrics: HrReadinessMetrics;
  actions: HrReadinessAction[];
  notice: string;
};

function nonNegative(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value >= 0;
}

export function deriveHrReadiness(metrics: HrReadinessMetrics): HrReadinessAction[] {
  const actions: HrReadinessAction[] = [];
  const add = (action: HrReadinessAction) => actions.push(action);

  // No database count proves a Board resolution was signed or its legal effect.
  add({
    id: "authority", priority: "P0", title: "Verify signed employment and remuneration authority",
    detail: "Match actual board minutes, accepted appointment amendments and service dates to each employee before activating salary or OT. Do not infer approval from a draft PDF or Git commit.",
    href: "/office/governance", action: "Review corporate records", requiresHumanEvidence: true,
  });
  if (metrics.activeMissingStartDates > 0) add({
    id: "start-dates", priority: "P0", title: "Correct verified employment commencement",
    detail: String(metrics.activeMissingStartDates) + " active employment record(s) lack a start date. Use authentic acceptance/joining evidence; do not backdate.",
    href: "/office/people#hr-employee-intake", action: "Open employee verification",
  });
  if (metrics.pendingWorktimeReviews > 0) add({
    id: "worktime-review", priority: "P0", title: "Independently review recorded worktime",
    detail: String(metrics.pendingWorktimeReviews) + " worktime case(s) need an eligible human reviewer. The submitter or employee cannot approve their own claim.",
    href: "/office/worktime", action: "Review worktime evidence",
  });
  if (metrics.overdueOpenSessions > 0) add({
    id: "stale-sessions", priority: "P0", title: "Reconcile overdue open attendance",
    detail: String(metrics.overdueOpenSessions) + " open session(s) are dated before today in IST. Close only using factual check-out or correction evidence.",
    href: "/office/worktime", action: "Check session exceptions",
  });
  if (metrics.activeEmployees > metrics.verifiedBankAccounts) add({
    id: "bank-verification", priority: "P0", title: "Verify employee payment destinations",
    detail: String(metrics.activeEmployees - metrics.verifiedBankAccounts) + " active employee(s) lack independent bank verification. Finance must review private evidence before payment.",
    href: "/office/people#hr-employee-intake", action: "Open restricted intake",
  });
  if (metrics.activeEmployees > 0 && metrics.approvedCompensationVersions !== null && metrics.approvedCompensationVersions < metrics.activeEmployees) add({
    id: "salary-versions", priority: "P0", title: "Activate only approved salary versions",
    detail: String(metrics.activeEmployees - (metrics.approvedCompensationVersions ?? 0)) + " active employment record(s) lack a currently effective approved salary. Expired, planned and duplicate versions do not count.",
    href: "/office/payroll", action: "Open compensation controls",
  });
  if (metrics.activeEmployees > 0 && metrics.approvedPayrollRules === 0) add({
    id: "payroll-rules", priority: "P0", title: "Obtain CA-reviewed statutory payroll rules",
    detail: "No approved payroll rule versions were found. Confirm applicable wages, tax, PF, ESI and professional-tax treatment before the first payroll calculation.",
    href: "/office/payroll", action: "Review payroll rules",
    requiresHumanEvidence: true,
  });
  if (metrics.activeEmployees > 0 && metrics.approvedWorktimePolicies !== null && metrics.approvedWorktimePolicies < metrics.activeEmployees) add({
    id: "ot-policy", priority: "P0", title: "Authorize employee-specific overtime policy",
    detail: String(metrics.activeEmployees - (metrics.approvedWorktimePolicies ?? 0)) + " active employee(s) lack currently effective, separately approved worktime policy. Contractual OT requires eligibility and dated authority.",
    href: "/office/worktime", action: "Review OT authority",
    requiresHumanEvidence: true,
  });
  add({
    id: "three-actor-payroll", priority: "P1", title: "Test independent payroll release controls",
    detail: "Before a real payout, verify three distinct authorized human identities for payroll preparation, Finance review and Owner approval. A salary batch does not execute a transfer.",
    href: "/office/payroll", action: "Run controlled acceptance",
    requiresHumanEvidence: true,
  });

  if (metrics.activeEmployees > 0 && metrics.verifiedIntakes < metrics.activeEmployees) add({
    id: "intake", priority: "P1", title: "Finish verified employee onboarding",
    detail: String(metrics.verifiedIntakes) + " verified intake record(s) for " +
      String(metrics.activeEmployees) + " active employment record(s). Complete privacy, documents, signatures and independent verification.",
    href: "/office/people#hr-employee-intake", action: "Review employee intake",
  });
  if (metrics.draftIntakes > 0) add({
    id: "intake-drafts", priority: "P1", title: "Resolve incomplete onboarding drafts",
    detail: String(metrics.draftIntakes) + " employee intake draft(s) await completion. The employee must submit their own accurate details.",
    href: "/office/people#hr-employee-intake", action: "Review onboarding status",
  });
  if (metrics.activeEmployees > metrics.issuedEmployeeIds) add({
    id: "employee-ids", priority: "P1", title: "Issue immutable employee identifiers",
    detail: String(metrics.issuedEmployeeIds) + " permanent ID(s) issued for " + String(metrics.activeEmployees) +
      " active employment record(s). Issuance must wait for appointment, HR and bank verification gates.",
    href: "/office/people#hr-employee-intake", action: "Review ID issuance",
  });
  if (metrics.historicImportBatches === 0) add({
    id: "attendance-history", priority: "P1", title: "Reconcile historical attendance",
    detail: "No attendance-workbook import batch is recorded. Compare original August–October 2026 books with existing sessions and stage only supported evidence.",
    href: "/office/people#hr-attendance-import", action: "Open workbook reconciliation",
    requiresHumanEvidence: true,
  });
  if (metrics.pendingLeaveRequests > 0) add({
    id: "leave-review", priority: "P1", title: "Review requested leave",
    detail: String(metrics.pendingLeaveRequests) + " leave request(s) are awaiting independent decisions and source-backed paid/unpaid classification.",
    href: "/office/worktime", action: "Review leave",
  });
  if (metrics.trustedManagedDevices === 0 && metrics.activeEmployees > 0) add({
    id: "trusted-devices", priority: "P1", title: "Review managed-device enrollment",
    detail: "No trusted, company-managed device is in the governed device registry. This is distinct from a separately approved login device.",
    href: "/office/devices", action: "Verify device posture",
  });
  if (!metrics.employeeIdMailEnabled || (metrics.sourceReadyMailEvents > 0 && metrics.enabledMailEvents === 0)) add({
    id: "employee-mail", priority: "P1", title: "Approve controlled employee notifications",
    detail: "Employee-ID delivery or lifecycle event policies are disabled. Test provider acknowledgements and approve only required events; do not enable all events blindly.",
    href: "/office/settings", action: "Review Owner delivery controls",
    requiresHumanEvidence: true, ownerOnly: true,
  });
  if (metrics.plannedEmployees > 0) add({
    id: "planned-employment", priority: "P2", title: "Review planned employee appointments",
    detail: String(metrics.plannedEmployees) + " employment record(s) remain PLANNED. Workspace access does not prove executed employment or payroll eligibility.",
    href: "/office/recruitment", action: "Review appointment pipeline",
  });
  const rank: Record<HrPriority, number> = { P0: 0, P1: 1, P2: 2 };
  return actions.filter(action => {
    // Restricted payroll/device data is null: never present missing visibility as zero.
    if (action.id === "salary-versions" && !nonNegative(metrics.approvedCompensationVersions)) return false;
    if (action.id === "payroll-rules" && !nonNegative(metrics.approvedPayrollRules)) return false;
    if (action.id === "ot-policy" && !nonNegative(metrics.approvedWorktimePolicies)) return false;
    if (action.id === "trusted-devices" && !nonNegative(metrics.trustedManagedDevices)) return false;
    return true;
  }).sort((a, b) => rank[a.priority] - rank[b.priority]);
}
