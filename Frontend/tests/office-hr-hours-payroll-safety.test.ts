import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const load = (path: string) => readFileSync(new URL(path, root), "utf8");
const migration = load("../Database/supabase/migrations/202611140003_hr_hours_payroll_revision_guards.sql");
const server = load("lib/office/worktime-payroll-server.ts");
const payroll = load("lib/office/payroll-server.ts");
const ui = load("components/office-worktime-console.tsx");
const payrollUi = load("components/office-payroll-console.tsx");
const api = load("app/api/office-worktime/route.ts");

describe("KRAVIA HR hours and payroll integration safety", () => {
  it("rejects duplicate active overtime premiums even with new evidence digests", () => {
    expect(migration).toContain("office_worktime_single_active_premium");
    expect(server).toContain('Existing overtime adjustments differ from verified attendance');
    expect(server).toContain('.in("adjustment_code", knownCodes)');
  });
  it("requires independent employee worktime verification and prevents stale payroll", () => {
    expect(server).toContain("calculateVerifiedMonthlyAttendance");
    expect(server).toContain("prepareVerifiedHoursPayroll");
    expect(server).toContain("review_required: unresolved > 0");
    expect(migration).toContain("office_payroll_invalidate_changed_draft");
    expect(migration).toContain("status='SUPERSEDED'");
    expect(migration).toContain("Submitted, approved, and paid payroll inputs cannot be rewritten");
  });
  it("keeps corrections source-backed and never silently marks missing time absent", () => {
    expect(server).toContain("unpaidLeaveUnits: 0, absenceUnits: 0");
    expect(server).toContain("missing");
    expect(payroll).toContain("expectedUpdatedAt");
    expect(api).toContain("AMEND_PENDING");
    expect(api).toContain("AUTO_ATTENDANCE");
    expect(migration).toContain("office_worktime_amend_pending");
    expect(ui).toContain("Edit pending");
    expect(payrollUi).toContain("Edit / rectify hours");
  });
  it("allows HR managers to queue recorded employee sessions, without payroll or self approval", () => {
    expect(migration).toContain("office_worktime_queue_recorded");
    expect(server).toContain("hasEffectiveHrManager");
    expect(server).toContain('case "QUEUE_RECORDED":');
    expect(server).toContain('case "DECIDE":');
    expect(ui).toContain("QUEUE_RECORDED");
  });
});
