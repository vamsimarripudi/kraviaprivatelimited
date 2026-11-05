import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("KRAVIA Office Experience 4.0 foundation", () => {
  it("loads the Experience 4 layer after the legacy compatibility layers", () => {
    const layout = read("app/office/layout.tsx");
    expect(layout.indexOf('import "./office-enterprise.css"')).toBeLessThan(layout.indexOf('import "./office-platform.css"'));
    expect(layout.indexOf('import "./office-platform.css"')).toBeLessThan(layout.indexOf('import "./office-experience-4.css"'));
  });

  it("uses the spatial ambient system on secure access and authenticated workspaces", () => {
    const auth = read("components/office-auth-layout.tsx");
    const shell = read("components/office-workspace-shell.tsx");
    expect(auth).toContain('<OfficeAmbientField variant="auth" />');
    expect(shell).toContain("office-v4");
    expect(shell).toContain('<OfficeAmbientField variant="workspace" />');
  });

  it("keeps the complete security journey visible across sign-in phases", () => {
    const login = read("components/workspace-login-form.tsx");
    expect(login).toContain('const steps = ["Credentials", "MFA", "Device trust", "Office"]');
    expect(login).toContain("<SecurityJourney phase={phase} />");
    expect(login).toContain('type Phase = "password" | "activate" | "verify" | "qr" | "device-approval" | "success"');
  });

  it("uses governed owner decision dialogs instead of browser-native confirms", () => {
    const newsletter = read("components/public-newsletter-manager.tsx");
    const resources = read("components/public-resource-publisher.tsx");
    const dialog = read("components/office-decision-dialog.tsx");
    expect(newsletter).toContain("OfficeDecisionDialog");
    expect(resources).toContain("OfficeDecisionDialog");
    expect(newsletter).not.toContain("window.confirm");
    expect(resources).not.toContain("window.confirm");
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
  });

  it("has responsive overlay, floating surface and reduced-motion rules", () => {
    const css = read("app/office/office-experience-4.css");
    expect(css).toContain("--ox4-shadow-floating");
    expect(css).toContain(".ui-drawer");
    expect(css).toContain("@media(max-width:620px)");
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
    expect(css).toContain("ox4-trust-float");
  });
  it("wraps Finance in the same Experience 4 root and style stack", () => {
    const finance = read("app/finance/layout.tsx");
    expect(finance).toContain('import "../office/office-platform.css"');
    expect(finance).toContain('import "../office/office-experience-4.css"');
    expect(finance).toContain('<div className="kravia-office">{children}</div>');
  });

  it("uses one accessible high-impact decision dialog for owner operations", () => {
    const dialog = read("components/office-decision-dialog.tsx");
    const resource = read("components/public-resource-publisher.tsx");
    const newsletter = read("components/public-newsletter-manager.tsx");
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('event.key === "Escape"');
    expect(resource).toContain("<OfficeDecisionDialog");
    expect(newsletter).toContain("<OfficeDecisionDialog");
  });
});
