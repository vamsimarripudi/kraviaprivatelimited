import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { capabilityCanAccessSection } from "../lib/office/workspace-capabilities";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const snapshot = read("lib/office/capability-server.ts");
const officeLayout = read("app/office/(workspace)/layout.tsx");
const financeLayout = read("app/finance/(workspace)/layout.tsx");
const shell = read("components/office-workspace-shell.tsx");
const handover = read("components/office-department-handover.tsx");
const migration = read("../Database/supabase/migrations/202611140002_department_handover_access_sync.sql");

describe("KRAVIA immediate delegated authority and reauthentication", () => {
  it("never treats the Founder role as a bypass for transferred Finance screens", () => {
    expect(capabilityCanAccessSection("finance", "dashboard", ["OWNER"], ["finance.read"])).toBe(true);
    expect(capabilityCanAccessSection("finance", "payments", ["OWNER"], ["finance.read"])).toBe(false);
    expect(capabilityCanAccessSection("finance", "payments", ["OWNER"], ["finance.payment.prepare"])).toBe(true);
    expect(capabilityCanAccessSection("finance", "payments", ["OWNER"], [])).toBe(false);
    expect(capabilityCanAccessSection("finance", "billing", ["OWNER"], ["finance.read"])).toBe(true);
    expect(capabilityCanAccessSection("office", "dashboard", ["OWNER"], [])).toBe(true);
    expect(capabilityCanAccessSection("finance", "dashboard", ["FINANCE"], ["finance.read"])).toBe(true);
    expect(capabilityCanAccessSection("finance", "dashboard", ["FINANCE"], [])).toBe(false);
  });
  it("uses the persistent former-owner records in both Office layouts", () => {
    expect(snapshot).toContain('from("office_department_former_owners")');
    expect(snapshot).toContain("delegatedDepartments");
    expect(officeLayout).toContain("delegatedDepartments={authorization.delegatedDepartments}");
    expect(financeLayout).toContain("delegatedDepartments={authorization.delegatedDepartments}");
    expect(shell).toContain('delegatedDepartments.includes("FINANCE")');
  });
  it("moves transferred Finance out of the operational Founder rail while retaining read-only oversight", () => {
    expect(shell).toContain('!(workspace === "office" && switchWorkspace === "finance" && financeDelegated)');
    expect(shell).toContain("Finance · Read-only Founder oversight");
    expect(shell).toContain('href="/office/requests"');
  });
  it("asks for re-login after the recipient accepts their last incoming transfer", () => {
    expect(handover).toContain('mode !== "recipient"');
    expect(handover).toContain('t.to_owner_user_id === data.actor.user_id');
    expect(handover).toContain('t.status === "PENDING"');
    expect(handover).toContain("setReauthRequired(noPending");
    expect(handover).toContain("All incoming department transfers accepted");
    expect(handover).toContain('fetch("/api/office-auth/sign-out"');
    expect(handover).toContain('router.replace("/office/login")');
    expect(handover).toContain("router.refresh()");
  });
  it("limits automatically activated read permissions and bumps both identities on acceptance", () => {
    expect(migration).toContain("'finance.read'");
    expect(migration).toContain("'people.basic.read'");
    expect(migration).toContain("'master.product.read'");
    expect(migration).toContain("'portfolio.read'");
    expect(migration).toContain("'strategy.read'");
    expect(migration).not.toContain("'finance.bank.read',");
    expect(migration).not.toContain("'people.sensitive.read',");
    expect(migration).toContain("p.high_risk=false");
    expect(migration).toContain("office_department_acceptance_authz_bump");
    expect(migration).toContain("authorization_version=i.authorization_version+1");
    expect(migration).toContain("old.status='PENDING' and new.status='ACCEPTED'");
    expect(migration).toContain("office_department_former_owners");
    expect(migration).toContain("return 'DENY'");
  });
});
