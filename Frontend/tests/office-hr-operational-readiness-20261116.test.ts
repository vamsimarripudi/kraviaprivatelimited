import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deriveHrReadiness, type HrReadinessMetrics } from "../lib/office/hr-readiness";

const metrics = (overrides: Partial<HrReadinessMetrics> = {}): HrReadinessMetrics => ({
  activeEmployees: 2,
  plannedEmployees: 1,
  activeMissingStartDates: 2,
  draftIntakes: 1,
  verifiedIntakes: 0,
  verifiedBankAccounts: 0,
  issuedEmployeeIds: 0,
  attendanceSessions: 15,
  openAttendanceSessions: 2,
  overdueOpenSessions: 0,
  pendingWorktimeReviews: 7,
  pendingLeaveRequests: 0,
  historicImportBatches: 0,
  approvedCompensationVersions: 0,
  approvedPayrollRules: 0,
  approvedWorktimePolicies: 0,
  payrollPeriods: 0,
  issuedPayslips: 0,
  trustedManagedDevices: 0,
  sourceReadyMailEvents: 81,
  enabledMailEvents: 0,
  employeeIdMailEnabled: false,
  ...overrides,
});

describe("HR operational readiness uses evidence rather than assumed payroll entitlements", () => {
  it("prioritizes missing employment proof, pending reviews and unapproved pay policies", () => {
    const tasks = deriveHrReadiness(metrics());
    const blockers = tasks.filter(item => item.priority === "P0").map(item => item.id);
    expect(blockers).toContain("authority");
    expect(blockers).toContain("start-dates");
    expect(blockers).toContain("worktime-review");
    expect(blockers).toContain("bank-verification");
    expect(blockers).toContain("salary-versions");
    expect(blockers).toContain("payroll-rules");
    expect(blockers).toContain("ot-policy");
    expect(tasks.map(item => item.id)).toContain("attendance-history");
    expect(tasks.map(item => item.id)).toContain("employee-mail");
    expect(tasks.map(item => item.id)).not.toContain("stale-sessions");
    expect(tasks[0].priority).toBe("P0");
    expect(tasks[tasks.length - 1].priority).toBe("P2");
  });

  it("never treats current-day open sessions as overdue work", () => {
    expect(deriveHrReadiness(metrics({ openAttendanceSessions: 2, overdueOpenSessions: 0 }))
      .some(item => item.id === "stale-sessions")).toBe(false);
    expect(deriveHrReadiness(metrics({ overdueOpenSessions: 2 }))
      .some(item => item.id === "stale-sessions")).toBe(true);
  });

  it("treats missing permissions as restricted, not zero", () => {
    const ids = deriveHrReadiness(metrics({
      approvedCompensationVersions: null, approvedPayrollRules: null,
      approvedWorktimePolicies: null, trustedManagedDevices: null,
    })).map(item => item.id);
    expect(ids).not.toContain("salary-versions");
    expect(ids).not.toContain("payroll-rules");
    expect(ids).not.toContain("ot-policy");
    expect(ids).not.toContain("trusted-devices");
    expect(ids).toContain("authority");
  });

  it("does not invent salary or overtime for planned positions", () => {
    const ids = deriveHrReadiness(metrics({
      activeEmployees: 0, plannedEmployees: 1,
      activeMissingStartDates: 0, pendingWorktimeReviews: 0,
      approvedCompensationVersions: 0, approvedPayrollRules: 0,
      approvedWorktimePolicies: 0, verifiedIntakes: 0,
    })).map(item => item.id);
    for (const id of ["bank-verification", "salary-versions", "payroll-rules", "ot-policy", "employee-ids"]) {
      expect(ids).not.toContain(id);
    }
    expect(ids).toContain("planned-employment");
  });

  it("always retains a real-human authorization step even if counts appear clear", () => {
    const ids = deriveHrReadiness(metrics({
      activeEmployees: 2, plannedEmployees: 0,
      activeMissingStartDates: 0, draftIntakes: 0, verifiedIntakes: 2,
      verifiedBankAccounts: 2, issuedEmployeeIds: 2,
      overdueOpenSessions: 0, pendingWorktimeReviews: 0,
      historicImportBatches: 1,
      approvedCompensationVersions: 2, approvedPayrollRules: 2,
      approvedWorktimePolicies: 2, trustedManagedDevices: 2,
      employeeIdMailEnabled: true, enabledMailEvents: 81,
    })).map(item => item.id);
    expect(ids).toContain("authority");
    expect(ids).toContain("three-actor-payroll");
    expect(ids).not.toContain("salary-versions");
    expect(ids).not.toContain("employee-mail");
  });

  it("keeps the endpoint private, same-role authorized and aggregate-only", () => {
    const server = readFileSync(new URL("../lib/office/hr-readiness-server.ts", import.meta.url), "utf8");
    const route = readFileSync(new URL("../app/api/office-hr-readiness/route.ts", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
    expect(server).toContain("requireOfficeActor()");
    expect(server).toContain('can("people.basic.read")');
    expect(server).toContain("Company-wide HR read authority is required");
    expect(server).toContain('head: true');
    expect(server).not.toContain("bank_account_ciphertext");
    expect(server).not.toContain("monthly_gross_minor");
    expect(route).toContain("private, no-store");
    expect(route).not.toContain("function POST");
    expect(shell).toContain("<OfficeHrReadiness />");
  });
});
