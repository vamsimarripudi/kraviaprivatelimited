import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(new URL("../lib/office/intelligence-server.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/office-workspace-shell.tsx", import.meta.url), "utf8");
const peek = readFileSync(new URL("../components/office-intelligence-peek.tsx", import.meta.url), "utf8");
const hub = readFileSync(new URL("../components/office-work-hub.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");

describe("KRAVIA compact personalised Office workspace", () => {
  it("retains the authenticated, read-only intelligence endpoint and avoids forbidden session id", () => {
    expect(server).toContain('from("office_auth_sessions_v2")');
    expect(server).toContain('select("user_id,status,last_seen_at,aal,expires_at,revoked_at")');
    expect(server).not.toContain('select("id,user_id,status,last_seen_at,aal,expires_at,revoked_at")');
    expect(server).toContain("unavailableSources");
    expect(server).toContain("unavailable_metrics");
  });

  it("places a real executive-only intelligence panel beside three-dot tools", () => {
    expect(shell).toContain("<OfficeIntelligencePeek key={pathname}/>");
    expect(shell).toContain('role === "OWNER" || role === "DIRECTOR"');
    expect(shell).toContain("office-topbar-tools");
    expect(peek).toContain('fetch("/api/office-intelligence"');
    expect(peek).toContain('aria-expanded={open}');
    expect(peek).not.toContain('method: "POST"');
    expect(home).not.toContain("<OfficeIntelligenceBrief compact />");
  });

  it("keeps actionable work focused while leaving secondary records available", () => {
    expect(hub).toContain('data-mode={mode}');
    expect(hub).toContain('aria-label="Create a new request"');
    expect(hub).toContain("styles.compactPanel");
    expect(home).toContain("office-dashboard-extras");
    expect(home).toContain("office-dashboard-quick-links");
    expect(home).toContain('href="/office/worktime"');
    expect(home).toContain('href="/office/my-role"');
    expect(home).toContain("<OfficeCompanyInbox compact />");
    expect(home).toContain("<OfficeActivityTimeline />");
  });
});
