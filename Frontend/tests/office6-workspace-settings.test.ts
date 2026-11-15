import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const settings = read("components/office-settings-hub.tsx");
const security = read("components/office-security-settings.tsx");
const connect = read("components/office-connect-settings.tsx");
const shell = read("components/office-workspace-shell.tsx");
const dashboard = read("components/internal-workspace-screen.tsx");
const css = read("app/office/office-experience-6.css");
const officeLayout = read("app/office/layout.tsx");
const financeLayout = read("app/finance/layout.tsx");

describe("approved Office Workspace V1 and Settings V2 implementation", () => {
  it("uses a shared compact Office and Finance shell, preserving capability-scoped routes", () => {
    expect(css).toContain("--office5-rail:64px");
    expect(css).toContain("--office5-context:216px");
    expect(css).toContain("height:56px!important");
    expect(css).toContain("margin-inline:24px!important");
    expect(officeLayout).toContain('import "./office-experience-6.css"');
    expect(financeLayout).toContain('import "../office/office-experience-6.css"');
    expect(shell).toContain("capabilityCanAccessSection");
    expect(shell).toContain("data-density={density}");
    expect(shell).toContain("kravia.office.sidebar.expanded");
    expect((shell.match(/<OfficeCommandPalette/g) ?? []).length).toBe(1);
  });

  it("makes theme compact and connects preferences to real local and authenticated controls", () => {
    expect(settings).toContain('className={styles.themeSwitch}');
    expect(settings).toContain('window.localStorage.setItem(preferenceKey, next)');
    expect(settings).toContain("readConnectPreferences");
    expect(settings).toContain("saveConnectPreferences");
    expect(settings).toContain("saveMotionMode");
    expect(settings).toContain("OfficeConnectSettings embedded");
    expect(connect).toContain("data-embedded={embedded}");
    expect(settings).not.toContain("themeGrid");
  });

  it("retains privileged server-side actions and independent authorization boundaries", () => {
    expect(settings).toContain('identity.roles.includes("OWNER")');
    expect(settings).toContain("OfficeEmployeeMailControls");
    expect(settings).toContain("OfficeLifecycleMailControls");
    expect(settings).toContain("OfficeSecuritySettings");
    expect(security).toContain("/api/office-auth/device");
    expect(security).toContain("/api/office-auth/sessions");
    expect(security).toContain("/api/office-auth/password");
    expect(security).toContain("/api/office-auth/authenticator-activations");
    expect(dashboard).toContain("office6-quick-actions");
    expect(dashboard).toContain('capabilityCanAccessSection("office", "approvals", identity.roles, permissions)');
  });
});
