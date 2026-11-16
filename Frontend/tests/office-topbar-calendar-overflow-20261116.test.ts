import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const shell = read("components/office-workspace-shell.tsx");
const calendar = read("components/office-topbar-calendar.tsx");
const calendarCss = read("components/office-topbar-calendar.module.css");
const topbarCss = read("app/office/office-topbar-focus-20261116.css");
const officeLayout = read("app/office/layout.tsx");
const financeLayout = read("app/finance/layout.tsx");
const search = read("components/office-command-palette.tsx");
const notifications = read("components/office-notification-hub.tsx");
const intelligence = read("components/office-intelligence-peek.tsx");
const clock = read("components/office-ist-clock.tsx");

describe("KRAVIA Office compact topbar and centered company calendar", () => {
  it("keeps only the navigation title, interactive IST clock and overflow visible on both layouts", () => {
    const header = shell.split('<header className="office-topbar office-topbar-compact">')[1]?.split("</header>")[0];
    expect(header).toBeTruthy();
    expect(header).toContain('className="office-breadcrumbs"');
    expect(header).toContain("office-mobile-trigger");
    expect(header).toContain("<OfficeTopbarCalendar");
    expect(header).toContain('className="office-more-button"');
    expect(header).not.toContain("<OfficeCommandPalette");
    expect(header).not.toContain("<OfficeNotificationHub");
    expect(header).not.toContain("<OfficeIntelligencePeek");
    expect(shell).toContain('className="office-topbar-utility-host"');
    expect(shell).toContain("<OfficeCommandPalette commands={commands} hideTrigger/>");
    expect(shell).toContain("<OfficeNotificationHub hideTrigger/>");
    expect(shell).toContain("<OfficeIntelligencePeek key={pathname} hideTrigger/>");
    expect(clock).toContain('const zone = "Asia/Kolkata"');
    expect(clock).not.toContain('className="office-ist-clock-zone"');
  });

  it("makes overflow tools operate the existing secure search, notification and executive intelligence surfaces", () => {
    expect(shell).toContain('openTopbarTool("search")');
    expect(shell).toContain('openTopbarTool("notifications")');
    expect(shell).toContain('openTopbarTool("intelligence")');
    expect(shell).toContain('identity.roles.some(role => role === "OWNER" || role === "DIRECTOR")');
    expect(shell).toContain("<OfficePresenceControl/>");
    expect(shell).toContain("<IdentityCard identity={identity}/>");
    expect(shell).toContain("<WorkspaceSignOutButton workspace={workspace}/>");
    expect(shell).toContain("switchTheme(); setMoreOpen(false);");
    expect(search).toContain('"kravia-office-open-search"');
    expect(search).toContain("hideTrigger = false");
    expect(notifications).toContain('"kravia-office-open-notifications"');
    expect(notifications).toContain("hideTrigger=false");
    expect(notifications).toContain("createPortal(<div className={styles.flyout}");
    expect(intelligence).toContain('"kravia-office-open-intelligence"');
    expect(intelligence).toContain("hideTrigger = false");
    expect(topbarCss).toContain('data-office-overflow-intelligence="true"');
  });

  it("portals the real permission-scoped company calendar to document.body and centers it", () => {
    expect(calendar).toContain("createPortal(");
    expect(calendar).toContain('fetch("/api/office-calendar"');
    expect(calendar).toContain('credentials: "same-origin"');
    expect(calendar).toContain('cache: "no-store"');
    expect(calendar).toContain("dateParts.formatToParts");
    expect(calendar).toContain('"Asia/Kolkata"');
    expect(calendar).toContain("monthDays(month.year, month.month)");
    expect(calendar).toContain('role="dialog" aria-modal="true"');
    expect(calendar).toContain('aria-label="Close company calendar"');
    expect(calendar).toContain('event.key === "Escape"');
    expect(calendar).toContain('event.key !== "Tab"');
    expect(calendar).toContain('event.target === event.currentTarget');
    expect(calendar).toContain('href="/office/calendar"');
    expect(calendarCss).toContain("position:fixed;inset:0;z-index:1900;display:grid;place-items:center");
    expect(calendarCss).toContain("background:transparent!important");
    expect(calendarCss).toContain('[data-theme="dark"]');
  });

  it("preserves compact width, accessible controls and isolated styles on desktop and mobile", () => {
    expect(topbarCss).toContain(".office-more-actions");
    expect(topbarCss).toContain("max-height:min(75dvh,620px)");
    expect(topbarCss).toContain("@media(max-width:620px)");
    expect(calendarCss).toContain("@media(max-width:720px)");
    expect(calendarCss).toContain("@media(prefers-reduced-motion:reduce)");
    expect(officeLayout).toContain('import "./office-topbar-focus-20261116.css"');
    expect(financeLayout).toContain('import "../office/office-topbar-focus-20261116.css"');
    expect(officeLayout.indexOf("office-topbar-focus-20261116.css")).toBeGreaterThan(
      officeLayout.indexOf("office-client-departments.css"),
    );
    // The role-scoped navigation and department assignment state are intact.
    expect(shell).toContain('const departmentReady=departmentLoad==="ready"&&loadedActor===identity.userId;');
    expect(shell).toContain("officeClientSectionVisible");
    expect(shell).toContain("selectedDepartmentCode");
  });
});
