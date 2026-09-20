import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const capabilities = readFileSync(new URL("../lib/office/workspace-capabilities.ts", import.meta.url), "utf8");
const capabilityServer = readFileSync(new URL("../lib/office/capability-server.ts", import.meta.url), "utf8");
const searchServer = readFileSync(new URL("../lib/office/search-server.ts", import.meta.url), "utf8");
const searchRoute = readFileSync(new URL("../app/api/office-search/route.ts", import.meta.url), "utf8");
const palette = readFileSync(new URL("../components/office-command-palette.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/office-workspace-shell.tsx", import.meta.url), "utf8");
const enterpriseCss = readFileSync(new URL("../app/office/office-enterprise.css", import.meta.url), "utf8");
const officeWorkspaceLayout = readFileSync(new URL("../app/office/(workspace)/layout.tsx", import.meta.url), "utf8");

describe("Office command and search boundary", () => {
  it("filters sensitive workspace navigation by effective capability hints", () => {
    expect(capabilities).toContain('"office:crm": ["sales.crm.read", "sales.crm.write"]');
    expect(capabilities).toContain('"office:engineering"');
    expect(capabilities).toContain('"office:people"');
    expect(capabilities).toContain('roles.includes("OWNER")');
    expect(screen).toContain("capabilityCanAccessSection");
    expect(officeWorkspaceLayout).toContain("getOfficeCapabilitySnapshot");
    expect(shell).toContain("capabilityCanAccessSection");
  });

  it("derives navigation hints from server-side active grants without weakening record authorization", () => {
    expect(capabilityServer).toContain("office_user_access_profiles");
    expect(capabilityServer).toContain("office_user_permission_overrides");
    expect(capabilityServer).toContain("office_access_profile_permissions");
    expect(screen).toContain("Direct URLs never bypass KRAVIA record and action authorization");
    expect(shell).toContain("OfficeWorkspaceProvider");
  });

  it("keeps global search read-only and reuses scoped domain read models", () => {
    expect(searchServer).toContain("getOfficeTaskInbox");
    expect(searchServer).toContain("getOfficeWorkOverview");
    expect(searchServer).toContain("getOfficeCrmOverview");
    expect(searchServer).toContain("getOfficeEngineeringControlCenter");
    expect(searchRoute).toContain("export async function GET");
    expect(searchRoute).not.toContain("export async function POST");
    expect(searchRoute).not.toContain("export async function PATCH");
    expect(searchRoute).not.toContain("export async function DELETE");
  });

  it("offers one capability-aware keyboard command surface with dialog focus safety", () => {
    expect(palette).toContain('event.key.toLowerCase() === "k"');
    expect(palette).toContain("/api/office-search");
    expect(palette).toContain("Navigation is capability-filtered");
    expect(palette).toContain("document.activeElement");
    expect(palette).toContain("querySelectorAll<HTMLElement>");
    expect(palette).toContain("aria-expanded={open}");
    expect(shell).toContain("<OfficeCommandPalette");
    expect(shell).not.toContain("<OfficeCommandCenter");
    expect(palette).not.toContain("pay vendor");
    expect(palette).not.toContain("deploy production");
  });

  it("provides mobile navigation, skip navigation and reduced-motion fallbacks", () => {
    expect(shell).toContain('className="office-skip-link"');
    expect(shell).toContain('id="office-main-content"');
    expect(shell).toContain('className="office-mobile-menu"');
    expect(shell).toContain("aria-expanded={mobileNavOpen}");
    expect(shell).toContain('data-mobile-open={mobileNavOpen ? "true" : "false"}');
    expect(enterpriseCss).toContain('data-mobile-open="true"');
    expect(enterpriseCss).toContain("@media(prefers-reduced-motion:reduce)");
    expect(enterpriseCss).toContain(":focus-visible");
  });
});
