import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const iamMigration = read("../Database/supabase/migrations/202611130001_future_effective_hr_access.sql");
const identity = read("lib/office/permission-engine.ts");
const worktime = read("lib/office/worktime-payroll-server.ts");
const actionRoute = read("app/api/office-worktime/route.ts");
const worktimeUi = read("components/office-worktime-console.tsx");
const tracker = read("components/office-presence-control.tsx");

describe("KRAVIA HR Manager effective-date access and evidence-based worktime", () => {
  it("keeps access subject to the future appointment date at both database and web authorization", () => {
    expect(iamMigration).toContain("add column if not exists effective_from timestamptz");
    expect(iamMigration).toContain("up.effective_from is null or up.effective_from<=now()");
    expect(iamMigration).toContain("public.office_effective_permission");
    expect(iamMigration).toContain("grant execute on function public.office_effective_permission");
    expect(identity).toContain('select("profile_code,scope_type,scope_key,status,expires_at,effective_from")');
    expect(identity).toContain('effectiveAt <= Date.now()');
    expect(identity).toContain("office_department_permission_verdict");
  });
  it("uses real check-in events rather than adding six hours merely for login", () => {
    expect(tracker).toContain('attendance("CHECK_IN")');
    expect(tracker).toContain('attendance("CHECK_OUT")');
    expect(tracker).toContain('attendance("BREAK_START")');
    expect(tracker).toContain('attendance("BREAK_END")');
    expect(tracker).toContain("Browser activity is never treated as payroll time");
    expect(worktime).toContain("office_attendance_sessions");
    expect(worktime).toContain("office_attendance_breaks");
  });
  it("permits historical evidence from August 1 only and requires independent approval", () => {
    expect(worktime).toContain("Historical attendance entry starts on 1 August 2026");
    expect(worktime).toContain("monthlyFlexibleWorktime");
    expect(worktime).toContain("attendance_targets: attendanceTargets");
    expect(actionRoute).toContain("officeMutationIsSameOrigin");
    expect(worktimeUi).toContain('sourceKind: "HISTORICAL_CORRECTION"');
    expect(worktimeUi).toContain("Break must be inside the actual shift");
    expect(worktimeUi).toContain("Do not enter a six-hour default");
    expect(worktime).toContain('people.update');
    const reviewPolicy = read("../Database/supabase/migrations/202611100002_worktime_salary_evidence.sql");
    expect(reviewPolicy).toContain("Worktime cannot be self-approved");
  });
  it("lets effective HR Managers file other-employee evidence without giving them self-approval or payroll execution", () => {
    const managerSql = read("../Database/supabase/migrations/202611130002_hr_worktime_evidence_authority.sql");
    expect(managerSql).toContain("h.profile_code='HR_MANAGER'");
    expect(managerSql).toContain("h.effective_from is null or h.effective_from<=now()");
    expect(managerSql).toContain("Worktime cannot be self-approved");
    expect(managerSql).toContain("office_effective_permission(p_actor,'people.update'");
    expect(managerSql).not.toContain("office_worktime_policy_decide(");
    expect(worktime).toContain("hrManagerActive");
    expect(worktime).toContain("propose_policy: policyProposal");
  });
  it("does not automatically grant salary, weekend bonuses or overtime compensation", () => {
    expect(worktimeUi).toContain("Potential overtime");
    expect(worktimeUi).toContain("not yet payable");
    expect(worktime).toContain('can(actor, "payroll.run.review")');
    expect(worktime).toContain('if (!state.preview || !state.approved_policy');
  });
});
