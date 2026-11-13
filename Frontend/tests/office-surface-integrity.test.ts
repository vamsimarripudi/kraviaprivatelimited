import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("KRAVIA Office shared UI integrity audit", () => {
  const css = read("app/office/office-surface-integrity.css");
  const layout = read("app/office/layout.tsx");
  const components = readdirSync(resolve(root, "components"))
    .filter((name) => /^(office|workforce|workspace|access-governance|internal|request-collaboration|corporate-office)/.test(name) && name.endsWith(".module.css"));

  it("audits the real Office CSS-module inventory instead of fixing one screenshot only", () => {
    expect(components.length).toBeGreaterThanOrEqual(80);
    for (const name of [
      "office-work-hub.module.css",
      "office-recruitment-workspace.module.css",
      "office-presence-control.module.css",
      "office-crm-workspace.module.css",
      "office-payroll-console.module.css",
      "office-document-studio.module.css",
      "office-portfolio.module.css",
    ]) expect(components).toContain(name);
    const hardcodedLightCount = components.reduce((sum, name) => sum + (
      read("components/" + name).match(/background(?:-color)?\s*:\s*(?:#(?:fff|ffffff)\b|rgba\(\s*255\s*,\s*255\s*,\s*255\b)/gi) ?? []
    ).length, 0);
    // Keep the compatibility guard until these legacy hard-coded colours are migrated.
    expect(hardcodedLightCount).toBeGreaterThan(150);
  });

  it("loads one scoped and ordered guard after legacy Office themes and contrast repairs", () => {
    const existing = 'import "./office-mobile-contrast.css"';
    const guard = 'import "./office-surface-integrity.css"';
    expect(layout).toContain(existing);
    expect(layout).toContain(guard);
    expect(layout.indexOf(guard)).toBeGreaterThan(layout.indexOf(existing));
    expect(css).toContain('.kravia-office .office-v2.office-modern');
    expect(css).not.toContain('body:has(.nav-wrap)');
    expect(css).not.toContain('body[data-theme');
  });

  it("keeps cards, panels, dialogs, drawers, forms and metrics legible in both themes", () => {
    for (const marker of [
      '[class*="_card__"]', '[class*="_panel__"]',
      '[class*="_dialog__"]', '[class*="_modal__"]',
      '[class*="_drawer__"]', '[class*="_metrics__"]',
      '[role="dialog"]', '[aria-modal="true"]',
      '[data-ui-theme="dark"]', '[data-ui-theme="light"]',
      'var(--office-ui-surface', 'var(--office-ui-ink',
      'var(--office-ui-control', 'select option'
    ]) expect(css).toContain(marker);
    expect(css).toContain(":not([data-office-presence-dialog])");
    expect(css).not.toContain('button[data-status');
    expect(css).not.toContain('background: #fff !important');
  });

  it("prevents iPhone clipping and Safari focus-zoom in existing department dialogs", () => {
    expect(css).toContain("100dvw - 24px");
    expect(css).toContain("100dvh - 24px");
    expect(css).toContain("env(safe-area-inset-top, 0px)");
    expect(css).toContain("env(safe-area-inset-bottom, 0px)");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain("overscroll-behavior: contain");
    expect(css).toContain("-webkit-overflow-scrolling: touch");
    expect(css).toContain("font-size: max(16px, 1rem) !important");
  });
});
