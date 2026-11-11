import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../Database/supabase/migrations/202611110001_reusable_workforce_role_packages.sql", import.meta.url),"utf8");
const server = readFileSync(new URL("../lib/office/role-package-server.ts", import.meta.url),"utf8");
const api = readFileSync(new URL("../app/api/office-role-packages/route.ts", import.meta.url),"utf8");
const ui = readFileSync(new URL("../components/office-role-package-studio.tsx", import.meta.url),"utf8");
const sections = readFileSync(new URL("../lib/office/workspaces.ts", import.meta.url),"utf8");
const shell = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url),"utf8");

describe("KRAVIA universal reusable workforce role packages", () => {
  it("uses one catalogue-backed package rather than per-employee or per-role code paths", () => {
    expect(sql).toContain("references public.office_position_catalog(code)");
    expect(sql).toContain("references public.office_department_catalog(code)");
    expect(sql).toContain("office_role_package_create");
    expect(sql).toContain("office_role_package_publish");
    expect(sql).toContain("office_role_package_apply");
    expect(ui).toContain("state.positions.map");
    expect(ui).toContain("state.departments.map");
    expect(ui).toContain("state.access_profiles");
    expect(sql).not.toContain("Vamsi Marripudi");
    expect(sql).not.toContain("Satish Manohar");
    expect(sql).not.toContain("Jaya Satyanarayana");
  });

  it("applies the canonical job and access profile mutators in a single database transaction", () => {
    expect(sql).toContain("public.office_assign_job(p_actor,p_target");
    expect(sql).toContain("public.office_assign_access_profile(p_actor,p_target");
    expect(sql).toContain("not public.office_actor_can_administer_target(p_actor,p_target)");
    expect(sql).toContain("public.office_role_package_authorised(p_actor,tmpl.department_code)");
    expect(sql).toContain("p_reason ||");
    expect(sql).toContain("p_reason || ' · ' || tmpl.code");
    expect(sql).toContain("tmpl.version::text,null);"); // permanent, non-expiring grant
  });

  it("version locks both package and applied snapshots", () => {
    expect(sql).toContain("unique(code,version)");
    expect(sql).toContain("office_role_packages_one_active_version");
    expect(sql).toContain("office_applied_role_package_sealed");
    expect(sql).toContain("snapshot_sha256");
    expect(sql).toContain("status='RETIRED'");
    expect(sql).toContain("unique(package_id,employee_user_id)");
  });

  it("keeps employee responsibility metadata distinct from authority and salary", () => {
    expect(sql).toContain("office_employee_functional_positions");
    expect(sql).toContain("office_role_package_onboarding_tasks");
    expect(sql).toContain("required_onboarding_never_waived");
    expect(sql).toContain("reviewed_by<>employee_user_id");
    expect(sql).not.toContain("office_payroll_calculate");
    expect(sql).not.toContain("office_department_transfer_accept");
    expect(ui).toContain("My roles & onboarding");
  });

  it("uses one employee-specific reader with strict manager and employee boundaries", () => {
    expect(server).toContain("requireOfficeActor");
    expect(server).toContain("targetId !== actorId && !manager");
    expect(server).toContain("access.profile.assign");
    expect(server).toContain('identity.aal !== "aal2"');
    expect(api).toContain("officeMutationIsSameOrigin");
    expect(api).toContain('action: z.literal("CREATE")');
    expect(api).toContain('action: z.literal("APPLY")');
    expect(api).toContain('action: z.literal("TASK")');
    expect(sections).toContain('"role-packages"');
    expect(sections).toContain('"my-role"');
    expect(shell).toContain('<OfficeRolePackageStudio view="admin" />');
    expect(shell).toContain('<OfficeRolePackageStudio view="self" />');
  });

  it("prevents browser database roles from invoking privileged package functions", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("from public,anon,authenticated");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("office_role_package_events");
  });
});
