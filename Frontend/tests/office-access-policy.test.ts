import { describe, expect, it } from "vitest";
import { canChangeRole, canChangeStatus, canInviteRoles, canManageTarget, hasRoleConflict } from "../lib/office/access-policy";
import { officeSections, roleCanAccessSection, roleCanAccessWorkspace } from "../lib/office/workspaces";
import { capabilityCanAccessSection } from "../lib/office/workspace-capabilities";

describe("KRAVIA Office owner-admin hierarchy", () => {
  it("requires explicit scoped capabilities for departmental navigation", () => {
    expect(capabilityCanAccessSection("office", "dashboard", ["MEMBER"], [])).toBe(true);
    expect(capabilityCanAccessSection("office", "governance", ["CS"], [])).toBe(false);
    expect(capabilityCanAccessSection("office", "governance", ["CS"], ["secretarial.board.read"])).toBe(true);
    expect(capabilityCanAccessSection("office", "people", ["OPERATIONS"], [])).toBe(false);
    expect(capabilityCanAccessSection("office", "contracts", ["LEGAL"], ["legal.contract.draft"])).toBe(true);
    expect(capabilityCanAccessSection("office", "portfolio", ["MEMBER"], [])).toBe(false);
  });

  it("keeps ADMIN in Office but out of Finance and business-data modules by default", () => {
    expect(roleCanAccessWorkspace("office", ["ADMIN"])).toBe(true);
    expect(roleCanAccessWorkspace("finance", ["ADMIN"])).toBe(false);
    expect(roleCanAccessSection(officeSections.access, ["ADMIN"])).toBe(true);
    expect(roleCanAccessSection(officeSections.documents, ["ADMIN"])).toBe(false);
    expect(roleCanAccessSection(officeSections.people, ["ADMIN"])).toBe(false);
    expect(roleCanAccessSection(officeSections.security, ["ADMIN"])).toBe(false);
  });

  it("lets OWNER appoint ADMIN but never assigns another OWNER through onboarding", () => {
    expect(canInviteRoles(["OWNER"], ["ADMIN"])).toEqual({ allowed: true });
    expect(canInviteRoles(["OWNER"], ["OWNER"])).toEqual(expect.objectContaining({ allowed: false }));
    expect(canChangeRole("owner", ["OWNER"], "user", [], "ADMIN", "GRANT")).toEqual({ allowed: true });
    expect(canChangeRole("owner", ["OWNER"], "user", [], "OWNER", "GRANT")).toEqual(expect.objectContaining({ allowed: false }));
  });

  it("lets ADMIN delegate professional roles without privileged escalation", () => {
    expect(canInviteRoles(["ADMIN"], ["CA", "FINANCE"])).toEqual({ allowed: true });
    expect(canInviteRoles(["ADMIN"], ["ADMIN"])).toEqual(expect.objectContaining({ allowed: false }));
    expect(canInviteRoles(["ADMIN"], ["DIRECTOR"])).toEqual(expect.objectContaining({ allowed: false }));
    expect(canChangeRole("admin", ["ADMIN"], "finance-user", ["FINANCE"], "CA", "GRANT")).toEqual({ allowed: true });
  });

  it("blocks ADMIN self-escalation and administration of privileged identities", () => {
    expect(canManageTarget("admin", ["ADMIN"], "admin", ["ADMIN"])).toEqual(expect.objectContaining({ allowed: false }));
    expect(canManageTarget("admin-1", ["ADMIN"], "admin-2", ["ADMIN"])).toEqual(expect.objectContaining({ allowed: false }));
    expect(canManageTarget("admin", ["ADMIN"], "director", ["DIRECTOR"])).toEqual(expect.objectContaining({ allowed: false }));
    expect(canChangeStatus("admin", ["ADMIN"], "owner", ["OWNER"], "SUSPENDED")).toEqual(expect.objectContaining({ allowed: false }));
  });

  it("enforces auditor separation of duties", () => {
    expect(hasRoleConflict(["AUDITOR", "FINANCE"])).toBe(true);
    expect(hasRoleConflict(["AUDITOR", "ADMIN"])).toBe(true);
    expect(hasRoleConflict(["AUDITOR", "CA"])).toBe(false);
    expect(canInviteRoles(["ADMIN"], ["AUDITOR", "FINANCE"])).toEqual(expect.objectContaining({ allowed: false }));
  });
});
