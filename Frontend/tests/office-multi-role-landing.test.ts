import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeAccessProfileIsEffective } from "../lib/office/access-profile-effective";
import { capabilityCanAccessSection } from "../lib/office/workspace-capabilities";
import { preferredLandingPath, preferredWorkspace, type OfficeRole } from "../lib/office/workspaces";

describe("KRAVIA Office multi-role sign-in and effective-dated authority", () => {
  it("lands mixed Director / Finance / HR / Member / Product Admin staff in Office", () => {
    const assigned: OfficeRole[] = ["DIRECTOR", "FINANCE", "HR", "MEMBER", "PRODUCT_ADMIN"];
    expect(preferredWorkspace(assigned)).toBe("office");
    expect(preferredLandingPath(assigned)).toBe("/office/dashboard");
    expect(capabilityCanAccessSection("office", "dashboard", assigned, [])).toBe(true);
    expect(capabilityCanAccessSection("finance", "dashboard", assigned, [])).toBe(false);
    expect(capabilityCanAccessSection("office", "payroll", assigned, [])).toBe(false);
    expect(capabilityCanAccessSection("office", "people", assigned, [])).toBe(false);
  });

  it("lands finance-only joiners on their own authorized profile rather than denied finance dashboard", () => {
    expect(preferredLandingPath(["FINANCE"])).toBe("/finance/my-role");
    expect(preferredLandingPath(["CA"])).toBe("/finance/my-role");
    expect(preferredLandingPath(["AUDITOR"])).toBe("/finance/my-role");
    expect(capabilityCanAccessSection("finance", "my-role", ["FINANCE"], [])).toBe(true);
    expect(capabilityCanAccessSection("finance", "dashboard", ["FINANCE"], [])).toBe(false);
    expect(preferredLandingPath(["ADMIN"])).toBe("/office/dashboard");
  });

  it("does not grant a scheduled HR Manager profile before its start time", () => {
    const assignment = { status: "ACTIVE", effective_from: "2026-11-13T18:30:00Z", expires_at: null };
    expect(officeAccessProfileIsEffective(assignment, Date.parse("2026-11-13T17:00:00Z"))).toBe(false);
    expect(officeAccessProfileIsEffective(assignment, Date.parse("2026-11-13T18:30:00Z"))).toBe(true);
  });

  it("rejects inactive, expired or malformed profile windows", () => {
    const now = Date.parse("2026-11-14T00:00:00Z");
    expect(officeAccessProfileIsEffective({ status: "REVOKED" }, now)).toBe(false);
    expect(officeAccessProfileIsEffective({ status: "ACTIVE", expires_at: "2026-11-13T18:30:00Z" }, now)).toBe(false);
    expect(officeAccessProfileIsEffective({ status: "ACTIVE", effective_from: "not-a-date" }, now)).toBe(false);
    expect(officeAccessProfileIsEffective({ status: "ACTIVE", effective_from: null, expires_at: null }, now)).toBe(true);
  });

  it("uses the same effective-date check in the navigation snapshot and action authorization", () => {
    const snapshot = readFileSync(new URL("../lib/office/capability-server.ts", import.meta.url), "utf8");
    const engine = readFileSync(new URL("../lib/office/permission-engine.ts", import.meta.url), "utf8");
    expect(snapshot).toContain('.select("profile_code,scope_type,scope_key,status,expires_at,effective_from")');
    expect(snapshot).toContain("officeAccessProfileIsEffective(row)");
    expect(engine).toContain("officeAccessProfileIsEffective(row)");
  });
});
