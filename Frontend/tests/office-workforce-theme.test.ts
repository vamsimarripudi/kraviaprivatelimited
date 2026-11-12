import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const panel = read("components/workforce-administration-panel.tsx");
const styles = read("components/workforce-administration-panel.module.css");
describe("Workforce responsive form contrast and protected identities", () => {
  it("uses shared black/white, blue/red design tokens for all workforce drawers", () => {
    expect(styles).toContain("var(--office-ui-surface)");
    expect(styles).toContain("var(--office-ui-ink)");
    expect(styles).toContain("var(--office-ui-accent)");
    expect(styles).toContain(".drawerBackdrop");
    expect(styles).toContain("calc(100dvh - env(safe-area-inset-top, 0px) - 12px)");
  });
  it("shows a legible readonly profile instead of a disabled Owner assignment form", () => {
    expect(panel).toContain("ProtectedPersonOverview");
    expect(panel).toContain("manageable ? <>");
    expect(panel).toContain("protectedDetails");
    expect(panel).toContain("Founder and other protected authorities cannot be reassigned");
  });
  it("retains live position, manager and explicit scoped authorization workflow", () => {
    expect(panel).toContain("ASSIGN_JOB");
    expect(panel).toContain("ASSIGN_PROFILE");
    expect(panel).toContain("REVOKE_PROFILE");
    expect(panel).toContain("EnterpriseCombobox");
  });
});
