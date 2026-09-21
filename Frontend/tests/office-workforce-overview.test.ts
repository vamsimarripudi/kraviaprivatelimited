import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overviewServer = readFileSync(new URL("../lib/office/workforce-overview-server.ts", import.meta.url), "utf8");
const overviewRoute = readFileSync(new URL("../app/api/office-workforce/overview/route.ts", import.meta.url), "utf8");
const overviewUi = readFileSync(new URL("../components/workforce-live-overview.tsx", import.meta.url), "utf8");

describe("KRAVIA Office live workforce overview", () => {
  it("requires the governed people-read permission at company scope", () => {
    expect(overviewServer).toContain('requireOfficePermission("people.basic.read", { type: "COMPANY" })');
  });

  it("uses only canonical first-party sessions for online presence", () => {
    expect(overviewServer).toContain('from("office_auth_sessions_v2")');
    expect(overviewServer).not.toContain('from("office_auth_sessions")');
    expect(overviewServer).not.toContain("risk_level");
    expect(overviewUi).toContain("KRAVIA first-party session");
  });

  it("keeps authentication, availability, workforce status and attendance as separate signals", () => {
    expect(overviewServer).toContain('online_state: sessionPresence(authSession, now)');
    expect(overviewServer).toContain("availability_status: effectivePresence.availability_status");
    expect(overviewServer).toContain('workforce_status: workStatus?.status ?? "WORKING"');
    expect(overviewServer).toContain('attendance_state: openAttendance ? (usersOnBreak.has(identity.user_id) ? "ON_BREAK" : "WORKING") : "OFF_CLOCK"');
  });

  it("does not select salary or bank data into the basic workforce view", () => {
    expect(overviewServer).not.toContain("salary");
    expect(overviewServer).not.toContain("bank_account");
    expect(overviewServer).not.toContain("compensation");
    expect(overviewServer).not.toContain("people.sensitive.read");
  });

  it("renders the live people view with attendance and security-session context", () => {
    expect(overviewUi).toContain("WORKFORCE LIVE");
    expect(overviewUi).toContain("People availability & attendance");
    expect(overviewUi).toContain("Security session");
    expect(overviewUi).toContain("Authentication, availability and payable attendance remain independent signals.");
  });

  it("is a no-store server endpoint", () => {
    expect(overviewRoute).toContain('"Cache-Control": "no-store"');
    expect(overviewRoute).toContain("getOfficeWorkforceLiveOverview");
  });
});
