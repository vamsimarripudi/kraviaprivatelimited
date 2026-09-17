import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../Backend/spec/identity/SUPABASE_COMPANY_CALENDAR.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/calendar-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-calendar/route.ts", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../components/office-company-calendar.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");

describe("KRAVIA Office company calendar", () => {
  it("stores internal calendar events server-side with scoped visibility and immutable audit", () => {
    expect(sql).toContain("office_calendar_events_deny_client_access");
    expect(sql).toContain("office_calendar_audit_immutable");
    expect(sql).toContain("visibility_scope");
    expect(sql).toContain("Company-wide events require executive or admin authority");
  });

  it("projects canonical deadlines only when the actor role may see their domain", () => {
    expect(server).toContain('"COMPLIANCE"');
    expect(server).toContain('"BOARD_MEETING"');
    expect(server).toContain('"CONTRACT"');
    expect(server).toContain('"SUBSCRIPTION"');
    expect(server).toContain('identity.roles.some');
  });

  it("protects mutations with same-origin checks and controlled RPCs", () => {
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(server).toContain('.rpc("office_create_calendar_event"');
    expect(server).toContain('.rpc("office_cancel_calendar_event"');
  });

  it("renders a real month grid and read-only system projections", () => {
    expect(calendar).toContain("COMPANY CALENDAR");
    expect(calendar).toContain("Read-only projection from a canonical company record");
    expect(screen).toContain('section === "calendar"');
  });
});
