import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../Database/supabase/migrations/202611100002_worktime_salary_evidence.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/worktime-payroll-server.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/office-worktime/route.ts", import.meta.url), "utf8");
const download = readFileSync(new URL("../app/api/office-salary-slips/[id]/pdf/route.ts", import.meta.url), "utf8");
const payroll = readFileSync(new URL("../lib/office/payroll-server.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../components/office-worktime-console.tsx", import.meta.url), "utf8");
const nav = readFileSync(new URL("../lib/office/workspaces.ts", import.meta.url), "utf8");

describe("KRAVIA worktime, payroll and wage-slip integration", () => {
  it("does not seed anyone or silently activate company OT rates", () => {
    expect(migration).toContain("office_worktime_policy_versions");
    expect(migration).toContain("status text not null default 'DRAFT'");
    expect(migration).toContain("office_worktime_policy_decide");
    expect(migration).toContain("approved_by <> proposed_by");
    expect(migration).toContain("approved_by <> employee_user_id");
    expect(migration).not.toMatch(/insert into public\.office_worktime_policy_versions\s*values/i);
  });
  it("keeps independent director review and source-backed past attendance", () => {
    expect(migration).toContain("office_worktime_review_cases");
    expect(migration).toContain("office_attendance_sessions");
    expect(migration).toContain("Canonical source is KRAVIA Office attendance");
    expect(migration).toContain("Worktime overlaps an existing approved claim");
    expect(migration).toContain("Worktime cannot be self-approved");
    expect(migration).toContain("'HISTORICAL_CORRECTION'");
    expect(api).toContain("officeMutationIsSameOrigin");
  });
  it("requires a real bank confirmation to reduce immutable outstanding wage debt", () => {
    expect(migration).toContain("office_salary_settlement_evidence");
    expect(migration).toContain("office_salary_settlement_decide");
    expect(migration).toContain("Verified bank credits exceed approved salary");
    expect(migration).toContain("Employee cannot approve their own salary payment");
    expect(migration).toContain("Future-dated bank credit is not verified evidence");
    expect(migration).toContain("Reviewed salary settlement evidence is immutable");
    expect(server).toContain('.eq("status", "VERIFIED")');
    expect(server).toContain("reconcileWageDebt");
  });
  it("issues salary slips only from approved locked payroll results", () => {
    expect(migration).toContain("office_salary_slip_issue");
    expect(migration).toContain("rec.status<>'LOCKED'");
    expect(migration).toContain("'APPROVED','PAYMENT_PREPARED'");
    expect(migration).toContain("office_salary_slip_integrity_check");
    expect(migration).toContain("office_salary_issue_write_once");
    expect(payroll).toContain('if (data === "APPROVED"');
    expect(payroll).toContain('admin.rpc("office_salary_slip_issue"');
    expect(payroll).toContain("bank_execution: false");
  });
  it("restricts downloads to employee and explicitly permitted readers", () => {
    expect(download).toContain("requireOfficeActor");
    expect(download).toContain('issue.employee_user_id !== identity.userId');
    expect(download).toContain("payroll.run.read");
    expect(download).toContain("office_salary_slip_integrity_check");
    expect(download).toContain("/api/v1/document-engine/render");
    expect(download).toContain("private, no-store");
    expect(download).toContain('"application/pdf"');
    expect(download).not.toContain("NEXT_PUBLIC_OFFICE_SUPABASE_SECRET_KEY");
  });
  it("exposes an employee personal records workspace with approved shift and leave previews", () => {
    expect(ui).toContain("Worktime, Flex Days & Wage Records");
    expect(ui).toContain("HISTORICAL_CORRECTION");
    expect(ui).toContain("/api/office-salary-slips/");
    expect(nav).toContain('worktime: { title: "Attendance & salary slips"');
  });
});
