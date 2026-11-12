import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const officeLayout = read("app/office/layout.tsx");
const financeLayout = read("app/finance/layout.tsx");
const css = read("app/office/office-design-system.css");

describe("KRAVIA shared Office & Finance visual system", () => {
  it("loads the final visual contract after previous generation styles in both workspaces", () => {
    expect(officeLayout.indexOf('import "./office-shell-next.css"')).toBeLessThan(officeLayout.indexOf('import "./office-design-system.css"'));
    expect(officeLayout).toContain('OfficeAppearanceRoot');
    expect(financeLayout).toContain('OfficeAppearanceRoot');
    expect(financeLayout.indexOf('import "../office/office-shell-next.css"')).toBeLessThan(financeLayout.indexOf('import "../office/office-design-system.css"'));
  });

  it("uses scoped light and dark tokens: black, white, blue and red, not old green surfaces", () => {
    expect(css).toContain(".kravia-office .office-v2.office-modern[data-ui-theme=\"dark\"]");
    expect(css).toContain("--office-ui-canvas: #050609");
    expect(css).toContain("--office-ui-ink: #f7f8fb");
    expect(css).toContain("--office-ui-accent: #4f8fff");
    expect(css).toContain("--office-ui-danger: #ff6574");
    expect(css).toContain("--office-ui-surface: #ffffff");
    expect(css).toContain("font-family: var(--font-sans");
    expect(css).not.toContain("#183d32");
  });

  it("keeps shared inputs, searchable combos and mobile touch targets readable", () => {
    expect(css).toContain(".enterprise-combobox-trigger");
    expect(css).toContain(".enterprise-combobox-popover");
    expect(css).toContain("min-height: 54px");
    expect(css).toContain("font-size: 16px !important");
    expect(css).toContain("[role=\"dialog\"]");
    expect(css).toContain('button[data-active="true"]');
    expect(css).toContain('.kravia-office[data-office-theme="dark"]');
    expect(css).toContain('.kravia-office-auth > section:first-child');
    expect(read("components/office-workspace-shell.tsx")).toContain('window.dispatchEvent(new CustomEvent("kravia-office-theme-change"');
    expect(read("components/office-workspace-processing.tsx")).toContain("office-workspace-processing.module.css");
    expect(read("components/office-workspace-processing.module.css")).toContain("var(--office-ui-canvas");
    expect(css).toContain('data-ui-theme="light"] .office-main');
  });
});
