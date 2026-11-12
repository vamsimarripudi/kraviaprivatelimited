import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const auth = read("components/office-auth-layout.tsx");
const office = read("app/office/layout.tsx");
const finance = read("app/finance/layout.tsx");
const css = read("app/office/office-auth-responsive.css");

describe("KRAVIA responsive full-screen Office and Finance sign-in", () => {
  it("shares the final authentication layout styles across both workspaces", () => {
    expect(office).toContain('import "./office-auth-responsive.css"');
    expect(finance).toContain('import "../office/office-auth-responsive.css"');
    expect(office.indexOf("office-design-system.css")).toBeLessThan(office.indexOf("office-auth-responsive.css"));
    expect(finance.indexOf("office-design-system.css")).toBeLessThan(finance.indexOf("office-auth-responsive.css"));
    expect(auth).toContain("data-office-auth-layout");
  });
  it("preserves the official logo, with light and dark contrast variants", () => {
    expect(auth).toContain('<BrandLogo priority />');
    expect(auth).toContain('data-office-logo-variant="light"');
    expect(auth).toContain('data-office-logo-variant="dark"');
    expect(css).toContain('filter: brightness(0) invert(1) !important');
    expect(css).toContain('data-office-theme="dark"');
    expect(css).toContain('data-office-theme="light"');
  });
  it("fills mobile and tablet viewports without clipping on small screens or landscape", () => {
    expect(css).toContain("@media (max-width: 980px)");
    expect(css).toContain("min-height: 100dvh !important");
    expect(css).toContain("max-height: none !important");
    expect(css).toContain("overflow: visible !important");
    expect(css).toContain("env(safe-area-inset-bottom");
    expect(css).toContain("font-size: 16px !important");
    expect(css).toContain("data-office-login-release");
  });
});
