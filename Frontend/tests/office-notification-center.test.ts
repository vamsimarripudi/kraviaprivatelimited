import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../Backend/spec/identity/SUPABASE_NOTIFICATION_CENTER.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/notification-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-notifications/route.ts", import.meta.url), "utf8");
const center = readFileSync(new URL("../components/office-notification-center.tsx", import.meta.url), "utf8");
const command = readFileSync(new URL("../components/office-command-center.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");

describe("KRAVIA Office notification center", () => {
  it("keeps notification state transitions auditable and server-only", () => {
    expect(sql).toContain("office_notification_events_immutable");
    expect(sql).toContain("office_notification_events_deny_client_access");
    expect(sql).toContain("office_update_notification_state");
    expect(sql).toContain("office_mark_all_notifications_read");
  });

  it("limits notification reads and mutations to the signed-in Office identity", () => {
    expect(server).toContain('.eq("user_id", identity.userId)');
    expect(server).toContain('p_actor: identity.userId');
    expect(route).toContain("officeMutationIsSameOrigin");
  });

  it("exposes the attention center from navigation and the top-bar bell", () => {
    expect(center).toContain("NOTIFICATION CENTER");
    expect(screen).toContain('section === "notifications"');
    expect(command).toContain('/office/notifications');
    expect(center).toContain("Mark all read");
  });
});
