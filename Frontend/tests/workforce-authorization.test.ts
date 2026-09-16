import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(new URL("../lib/office/workforce-admin-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-access/workforce/route.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../components/workforce-administration-panel.tsx", import.meta.url), "utf8");
const combobox = readFileSync(new URL("../components/enterprise-combobox.tsx", import.meta.url), "utf8");

describe("KRAVIA workforce authorization administration", () => {
  it("separates position, profiles, permissions and devices", () => {
    expect(server).toContain('office_position_catalog');
    expect(server).toContain('office_access_profile_catalog');
    expect(server).toContain('office_permission_catalog');
    expect(server).toContain('office_device_registry');
  });

  it("uses controlled database RPCs for workforce mutations", () => {
    expect(server).toContain('office_assign_job');
    expect(server).toContain('office_assign_access_profile');
    expect(server).toContain('office_revoke_access_profile');
    expect(server).toContain('office_set_permission_override');
    expect(server).toContain('office_approve_device');
    expect(server).toContain('office_revoke_device');
  });

  it("keeps high-risk individual allows owner controlled", () => {
    expect(server).toContain('High-risk individual ALLOW overrides require OWNER authority');
    expect(server).toContain('permission.high_risk');
  });

  it("protects every workforce mutation with same-origin and AAL2 administration", () => {
    expect(route).toContain('officeMutationIsSameOrigin');
    expect(server).toContain('context.identity.aal !== "aal2"');
    expect(server).toContain('canAdministerAccess');
    expect(server).toContain('canManageTarget');
  });

  it("implements searchable enterprise selectors and scoped access preview", () => {
    expect(combobox).toContain('Search');
    expect(combobox).toContain('enterprise-combobox-popover');
    expect(panel).toContain('Scope key');
    expect(panel).toContain('Position and reporting line');
    expect(panel).toContain('Permission exception');
    expect(panel).toContain('Current profile assignments');
  });
});
