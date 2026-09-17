import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../Database/supabase/migrations/202609180001_payroll_engine.sql", import.meta.url), "utf8");
const ruleMigration = readFileSync(new URL("../../Database/supabase/migrations/202609180002_payroll_rule_governance.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/payroll-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-payroll/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-payroll-console.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const workspaces = readFileSync(new URL("../lib/office/workspaces.ts", import.meta.url), "utf8");

describe("KRAVIA Office Payroll OS", () => {
  it("keeps compensation effective-dated and separates CTC from monthly gross", () => {
    expect(migration).toContain("office_compensation_versions");
    expect(migration).toContain("annual_ctc_minor");
    expect(migration).toContain("monthly_gross_minor");
    expect(migration).toContain("effective_from");
    expect(migration).toContain("effective_to");
    expect(migration).toContain("COMPENSATION_CHANGE_V1");
    expect(component).toContain("Historical compensation has not been overwritten");
  });

  it("does not hard-code statutory payroll rates and requires source-backed rule versions", () => {
    expect(migration).toContain("Payroll law/tax rates are intentionally not hard-coded here");
    expect(ruleMigration).toContain("source reference");
    expect(ruleMigration).toContain("Payroll rule creator cannot approve the same version");
    expect(component).toContain("Do not invent a PF, ESI, TDS, minimum-wage or other statutory rate here");
    expect(server).toContain("office_payroll_rule_create");
    expect(server).toContain("office_payroll_rule_approve");
  });

  it("blocks unresolved attendance and unreviewed adjustments before payroll calculation", () => {
    expect(migration).toContain("Payroll contains unresolved attendance units");
    expect(migration).toContain("Payroll contains unreviewed adjustments");
    expect(migration).toContain("Adjustment creator cannot approve the same adjustment");
    expect(migration).toContain("Mid-period compensation change requires an explicit arrears/off-cycle adjustment before calculation");
    expect(migration).toContain("calculation_hash");
    expect(migration).toContain("extensions.digest");
  });

  it("separates payroll approval and salary batch preparation from bank execution", () => {
    expect(migration).toContain("PAYROLL_RUN_APPROVAL_V1");
    expect(migration).toContain("office_salary_payment_batches");
    expect(migration).toContain("SALARY_BATCH_PREPARED");
    expect(migration).toContain("'bank_execution',false");
    expect(server).toContain("bank_execution: false");
    expect(component).toContain("No bank transfer has been executed");
    expect(component).toContain("has not executed a bank transfer merely by creating it");
  });

  it("protects mutations and exposes payroll in both HR and Finance workspaces", () => {
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(route).toContain("PREPARE_SALARY_BATCH");
    expect(screen).toContain("OfficePayrollConsole");
    expect(screen).toContain('section === "payroll"');
    expect(workspaces).toContain('title: "Payroll OS"');
    expect(workspaces).toContain('title: "Payroll"');
  });
});
