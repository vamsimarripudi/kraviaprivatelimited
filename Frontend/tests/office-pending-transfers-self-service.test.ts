import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections, roleCanAccessSection } from "../lib/office/workspaces";
import { capabilityCanAccessSection } from "../lib/office/workspace-capabilities";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

const shell = read("components/office-workspace-shell.tsx");
const screen = read("components/internal-workspace-screen.tsx");
const panel = read("components/office-department-handover.tsx");
const api = read("app/api/office-departments/route.ts");
const departmentSql = read("../Database/supabase/migrations/202611100001_permanent_department_ownership.sql");

describe("KRAVIA employee department-transfer inbox", () => {
  it("exposes the personal transfer inbox to an employee without broad administrator rights", () => {
    expect("my-transfers" in officeSections).toBe(true);
    expect(roleCanAccessSection(officeSections["my-transfers"], ["DIRECTOR", "FINANCE", "HR", "MEMBER", "PRODUCT_ADMIN"])).toBe(true);
    expect(roleCanAccessSection(officeSections["my-transfers"], ["ADMIN", "CS", "LEGAL", "OPERATIONS"])).toBe(true);
    expect(capabilityCanAccessSection("office", "my-transfers", ["MEMBER"], [])).toBe(true);
    expect(capabilityCanAccessSection("office", "department-ownership", ["MEMBER"], [])).toBe(false);
    expect(capabilityCanAccessSection("office", "department-ownership", ["DIRECTOR", "FINANCE", "HR"], [])).toBe(false);
  });

  it("adds personal navigation without opening company-wide Administration permissions", () => {
    expect(shell).toContain('"my-transfers":"My work"');
    expect(shell).toContain('"my-transfers":ArrowRightLeft');
    expect(screen).toContain('section === "my-transfers" ? <OfficeDepartmentHandover mode="recipient" />');
    expect(screen).toContain('section === "department-ownership" ? <OfficeDepartmentHandover />');
  });

  it("filters the recipient view by authenticated user identity and excludes proposal/cancel forms", () => {
    expect(panel).toContain('mode = "manage"');
    expect(panel).toContain('item.to_owner_user_id === data.actor.user_id');
    expect(panel).toContain('mode === "recipient" ? incoming : data.transfers');
    expect(panel).toContain('const canPropose = mode === "manage"');
    expect(panel).toContain('const canCancel = mode === "manage"');
    expect(panel).toContain('selected && mode === "manage"');
    expect(panel).toContain('window.confirm');
    expect(panel).toContain('transfer_id: pending.id');
    expect(panel).toContain('if (body.action === "ACCEPT") router.refresh()');
  });

  it("does not expose the employee directory or permit third-party acceptance through the API", () => {
    expect(api).toContain("requireOfficeActor");
    expect(api).toContain("officeMutationIsSameOrigin");
    expect(api).toContain("participantIds");
    expect(api).toContain("(people.data ?? []).filter(item => participantIds.has(item.user_id))");
    expect(api).toContain('item.to_owner_user_id === identity.userId');
    expect(api).toContain('admin.rpc(input.action === "ACCEPT" ? "office_department_transfer_accept"');
    expect(departmentSql).toContain("Only the proposed recipient can accept");
    expect(departmentSql).toContain("p_actor<>req.to_owner_user_id");
  });

  it("keeps one transfer pending until the named recipient accepts", () => {
    expect(departmentSql).toContain("office_department_one_pending_transfer");
    expect(departmentSql).toContain("Proposer cannot accept their own transfer");
    expect(departmentSql).toContain("office_department_transfer_events");
    expect(departmentSql).toContain("office_department_former_owners");
  });
});
