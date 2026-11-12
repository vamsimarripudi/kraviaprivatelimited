import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const profile = readFileSync(new URL("../components/office-employee-summary.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const worktime = readFileSync(new URL("../lib/office/worktime-payroll-server.ts", import.meta.url), "utf8");
const roles = readFileSync(new URL("../lib/office/role-package-server.ts", import.meta.url), "utf8");

describe("KRAVIA personal employee profile", () => {
  it("reads only real approved evidence from existing authenticated employee endpoints", () => {
    expect(profile).toContain('fetchPrivate<Roles>("/api/office-role-packages")');
    expect(profile).toContain('fetchPrivate<Worktime>("/api/office-worktime")');
    expect(profile).toContain('credentials: "same-origin"');
    expect(profile).toContain('cache: "no-store"');
    expect(profile).toContain("Approved monthly gross");
    expect(profile).toContain("Approved overtime");
    expect(profile).toContain("No approved salary slips have been issued");
    expect(profile).toContain("No slip or payment presumed");
  });

  it("never fabricates salary: expose only the approved compensation row", () => {
    expect(worktime).toContain('.eq("status", "APPROVED")');
    expect(worktime).toContain("approved_monthly_gross_minor:");
    expect(profile).toContain('typeof worktime?.approved_monthly_gross_minor === "number"');
    expect(profile).toContain('slip.confirmedMinor');
  });

  it("keeps all formal onboarding/permissions accessible but collapsed", () => {
    expect(home).toContain("OfficeEmployeeSummary");
    expect(home).toContain("office-employee-full-record");
    expect(home).toContain('<OfficeRolePackageStudio view="self" />');
    expect(roles).toContain("targetId !== actorId && !manager");
    expect(roles).toContain("Employee role records are restricted".replace("Employee role records", "Other employees' role records"));
  });

  it("does not offer the HR-only recruitment link to every employee", () => {
    expect(profile).not.toContain('href="/office/recruitment"');
    expect(profile).toContain('href="/office/worktime"');
  });
});
