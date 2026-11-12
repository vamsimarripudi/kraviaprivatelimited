import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const shell = read("components/office-workspace-shell.tsx");
const css = read("app/office/office-shell-next.css");
const officeLayout = read("app/office/layout.tsx");
const financeLayout = read("app/finance/layout.tsx");
const signOut = read("components/workspace-sign-out-button.tsx");
const access = read("components/access-governance-panel.tsx");
const accessCss = read("components/access-governance-panel.module.css");
const workforce = read("lib/office/workforce-admin-server.ts");
const settings = read("components/office-settings-hub.tsx");

describe("KRAVIA Office responsive mega navigation and compact access", () => {
  it("keeps a parallel rail and independently scrollable mega menu on every desktop screen", () => {
    expect(shell).toContain("office-icon-rail");
    expect(shell).toContain("office-mega-panel");
    expect(shell).toContain("office-rail-category-list");
    expect(shell).toContain("office-mega-subgroup");
    expect(shell).toContain("capabilityCanAccessSection");
    expect(css).toContain("height:100dvh!important");
    expect(css).toContain("grid-template-columns:62px minmax(0,1fr)!important");
    expect(css).toContain(".office-category-links");
    expect(css).toContain("overflow-y:auto");
  });
  it("uses compact, sticky breadcrumbs, mobile drawer and a top-right overflow card", () => {
    expect(shell).toContain('className="office-breadcrumbs"');
    expect(shell).toContain('aria-label="Breadcrumb"');
    expect(shell).toContain('className="office-more-card"');
    expect(shell).toContain('className="office-more-button"');
    expect(shell).toContain('className="office-mobile-trigger"');
    expect(shell).toContain('className="office-mobile-backdrop"');
    expect(css).toContain("position:sticky!important;top:0!important");
    expect(css).toContain("z-index:240!important");
    expect(css).toContain("width:min(335px,92vw)");
  });
  it("keeps icon-only footer controls and theme across Office and Finance", () => {
    expect(shell).toContain('<WorkspaceSignOutButton workspace={workspace} iconOnly/>');
    expect(shell).toContain("kravia.office.appearance");
    expect(shell).toContain("kravia-office-theme-change");
    expect(signOut).toContain('aria-label={pending ? "Signing out" : "Sign out of KRAVIA Office"}');
    expect(officeLayout).toContain('import "./office-shell-next.css"');
    expect(financeLayout).toContain('import "../office/office-shell-next.css"');
    expect(css).toContain('[data-ui-theme="dark"]');
    expect(settings).toContain('window.localStorage.setItem(preferenceKey, next)');
    expect(settings).toContain("OfficeSecuritySettings");
  });
  it("clearly identifies occupied roles without removing the catalogue", () => {
    expect(access).toContain("assignedRoles");
    expect(access).toContain("Assigned · ");
    expect(access).toContain('data-assigned={Boolean(assigned)}');
    expect(access).toContain("disabled={pending || Boolean(assigned)}");
    expect(access).toContain("assignedToOthers");
    expect(accessCss).toContain(".roleTag");
    expect(access).toContain("inviteDisclosure");
    expect(access).toContain("userDisclosure");
    expect(access).toContain("Roles · Team · MFA · Review");
  });
  it("uses actual canonical job-assignment dates, fixing a production 500", () => {
    expect(workforce).toContain("status,start_date,end_date,updated_at");
    expect(workforce).not.toContain("status,started_at,ended_at,updated_at");
  });
});
