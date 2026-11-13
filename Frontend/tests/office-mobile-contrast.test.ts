import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("KRAVIA Office mobile dark/light contrast guard", () => {
  const layout = source("app/office/layout.tsx");
  const css = source("app/office/office-mobile-contrast.css");
  const workHub = source("components/office-work-hub.tsx");
  const recruitment = source("components/office-recruitment-workspace.tsx");

  it("loads component-specific contrast fixes after both global Office theme generations", () => {
    expect(layout).toContain('import "./office-design-system.css"');
    expect(layout).toContain('import "./office-auth-responsive.css"');
    expect(layout).toContain('import "./office-mobile-contrast.css"');
    expect(layout.indexOf("office-mobile-contrast.css")).toBeGreaterThan(layout.indexOf("office-auth-responsive.css"));
    expect(layout.indexOf("office-mobile-contrast.css")).toBeGreaterThan(layout.indexOf("office-design-system.css"));
    expect(css).toContain(".kravia-office .office-modern .office-main");
    expect(css).not.toContain("body:has(.nav-wrap)");
  });

  it("keeps Recruitment's dialog and all form labels on the same active theme surfaces", () => {
    expect(recruitment).toContain("data-office-recruitment-backdrop");
    expect(recruitment).toContain("data-office-recruitment-dialog");
    expect(recruitment).toContain('role="dialog" aria-modal="true"');
    expect(recruitment).toContain('aria-label="Close recruitment form"');
    expect(css).toContain("[data-office-recruitment-dialog] {");
    expect(css).toContain("background: var(--office-ui-surface, #fff) !important");
    expect(css).toContain("color: var(--office-ui-ink, #101827) !important");
    expect(css).toContain(":is(header, h3, label, p, span, legend)");
    expect(css).toContain(":is(input:not([type=\"checkbox\"]), select, textarea)");
    expect(css).toContain("background: var(--office-ui-control, #fff) !important");
    expect(css).toContain("select option");
    expect(css).toContain("footer button[type=\"submit\"]");
  });

  it("fixes My Work metric cards, summary badges and new-request icon contrast", () => {
    expect(workHub).toContain("data-office-work-hub");
    expect(workHub).toContain("data-office-work-metrics");
    expect(workHub).toContain("data-office-work-hero");
    expect(workHub).toContain("data-office-new-request");
    expect(workHub.match(/data-office-work-panel/g)).toHaveLength(4);
    expect(css).toContain("[data-office-work-metrics] > article");
    expect(css).toContain("[data-office-work-metrics] :is(span, small)");
    expect(css).toContain("[data-office-work-metrics] strong");
    expect(css).toContain("[data-office-work-panel] > summary");
    expect(css).toContain("[data-office-new-request] svg");
    expect(css).toContain("background: #1559ce !important");
  });

  it("prevents iPhone form clipping, tiny touch targets and Safari focus zoom", () => {
    expect(css).toContain("100dvh");
    expect(css).toContain("env(safe-area-inset-top");
    expect(css).toContain("env(safe-area-inset-bottom");
    expect(css).toContain("overscroll-behavior: contain");
    expect(css).toContain("-webkit-overflow-scrolling: touch");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("font-size: 16px !important");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain("@media (max-width: 360px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
