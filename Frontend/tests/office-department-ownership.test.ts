import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../Database/supabase/migrations/202611100001_permanent_department_ownership.sql", import.meta.url), "utf8");
const authz = readFileSync(new URL("../lib/office/permission-engine.ts", import.meta.url), "utf8");
const snapshot = readFileSync(new URL("../lib/office/capability-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-departments/route.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../components/office-department-handover.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const workspaces = readFileSync(new URL("../lib/office/workspaces.ts", import.meta.url), "utf8");

describe("KRAVIA permanent department ownership", () => {
  it("requires a recipient to accept another person's pending proposal", () => {
    expect(sql).toContain("office_department_transfer_propose");
    expect(sql).toContain("office_department_transfer_accept");
    expect(sql).toContain("Only the proposed recipient can accept");
    expect(sql).toContain("Proposer cannot accept their own transfer");
    expect(sql).toContain("Only the current department owner may propose a transfer");
    expect(sql).toContain("office_department_one_pending_transfer");
    expect(sql).toContain("if req.status<>'PENDING'");
    expect(sql).toContain("if p_actor<>req.to_owner_user_id then");
    expect(sql).not.toContain("access_grant_expires_at");
  });

  it("preserves former-owner DENY through alternate COMPANY profiles and OWNER roles", () => {
    const verdict = sql.indexOf("verdict:=public.office_department_permission_verdict");
    const owner = sql.indexOf("verdict='DEPARTMENT_OWNER' or exists");
    expect(verdict).toBeGreaterThan(0);
    expect(verdict).toBeLessThan(owner);
    expect(sql).toContain("if verdict='DENY' then return false");
    expect(sql).toContain("public.office_department_former_owners");
    expect(sql).toContain("permission_record.owner_bypass is distinct from false");
    expect(sql).toContain("and o.effect='DENY'");
    expect(sql).toContain("if current_owner=p_actor then return 'DEPARTMENT_OWNER'");
    expect(sql).toContain("permission_action like 'READ%'");
  });

  it("checks the SQL verdict before the frontend Owner shortcut", () => {
    expect(authz.indexOf('admin.rpc("office_department_permission_verdict"')).toBeLessThan(
      authz.indexOf('identity.roles.includes("OWNER") || verdict === "DEPARTMENT_OWNER"'),
    );
    expect(authz).toContain('if (verdict === "DENY")');
    expect(authz).toContain('source: "DEPARTMENT_DENY"');
  });

  it("removes former-owner write capabilities from the UI and leaves read access intact", () => {
    expect(sql).toContain("office_department_capability_changes");
    expect(snapshot).toContain('admin.rpc("office_department_capability_changes"');
    expect(snapshot).toContain("const denied = new Set");
    expect(snapshot).toContain('source: "DEPARTMENT_OWNER"');
    expect(screen).toContain("financeReadOnly");
    expect(screen).toContain('permissions.includes("finance.invoice.create")');
  });

  it("exposes a same-origin recipient workflow without self-administered handovers", () => {
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(route).toContain("requireOfficeActor");
    expect(route).toContain("office_department_transfer_propose");
    expect(route).toContain("office_department_transfer_accept");
    expect(route).toContain("office_department_transfer_cancel");
    expect(panel).toContain("No access has changed until the recipient accepts");
    expect(workspaces).toContain('"department-ownership"');
  });

  it("does not give anonymous browser roles access to transfer records or RPCs", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("office_department_transfer_events");
    expect(sql).toContain("to kravia_office_backend");
    expect(sql).not.toContain("grant select, insert, update, delete on public.office_department_ownership");
  });
});
