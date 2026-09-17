import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  attendanceState,
  effectiveAvailability,
  trackedAttendanceSeconds,
} from "../lib/office/workforce-presence";

const workforceSql = readFileSync(new URL("../../Backend/spec/workforce/SUPABASE_PRESENCE_ATTENDANCE.sql", import.meta.url), "utf8");
const workforceServer = readFileSync(new URL("../lib/office/workforce-presence-server.ts", import.meta.url), "utf8");
const presenceRoute = readFileSync(new URL("../app/api/office-presence/route.ts", import.meta.url), "utf8");
const attendanceRoute = readFileSync(new URL("../app/api/office-attendance/route.ts", import.meta.url), "utf8");
const presenceControl = readFileSync(new URL("../components/office-presence-control.tsx", import.meta.url), "utf8");

describe("KRAVIA Office workforce presence and attendance", () => {
  it("expires temporary availability without turning leave into a user-set presence value", () => {
    const expired = effectiveAvailability({
      availability_status: "FOCUS",
      work_mode: "REMOTE",
      status_until: "2026-09-17T04:00:00.000Z",
    }, Date.parse("2026-09-17T05:00:00.000Z"));
    expect(expired.availability_status).toBe("AVAILABLE");
    expect(workforceSql).toContain("'AVAILABLE','FOCUS','IN_MEETING','OOO','DND'");
    expect(workforceSql).toContain("office_work_status_assignments");
    expect(workforceSql).toContain("'PAID_LEAVE','SICK_LEAVE','UNPAID_LEAVE'");
  });

  it("keeps authentication presence separate from governed attendance time", () => {
    const now = Date.parse("2026-09-17T10:00:00.000Z");
    expect(trackedAttendanceSeconds(
      { check_in_at: "2026-09-17T06:00:00.000Z", check_out_at: null },
      [
        { started_at: "2026-09-17T07:00:00.000Z", ended_at: "2026-09-17T07:30:00.000Z" },
        { started_at: "2026-09-17T09:45:00.000Z", ended_at: null },
      ],
      now,
    )).toBe(11_700);
    expect(attendanceState(true, true)).toBe("ON_BREAK");
    expect(attendanceState(false, false)).toBe("OFF_CLOCK");
    expect(workforceSql).toContain("never use raw login duration as payroll payable time");
  });

  it("uses service-role-only RPCs, immutable events and deny-by-default direct database access", () => {
    expect(workforceSql).toContain("office_workforce_event_immutable_guard");
    expect(workforceSql).toContain("enable row level security");
    expect(workforceSql).toContain("revoke all on public.office_presence_state");
    expect(workforceSql).toContain("grant execute on function public.office_set_presence");
    expect(workforceSql).toContain("grant execute on function public.office_attendance_act");
    expect(workforceServer).toContain("requireOfficeActor");
    expect(workforceServer).toContain("office_set_presence");
    expect(workforceServer).toContain("office_attendance_act");
  });

  it("protects workforce mutations from cross-origin requests and uses idempotency keys", () => {
    expect(presenceRoute).toContain("officeMutationIsSameOrigin");
    expect(attendanceRoute).toContain("officeMutationIsSameOrigin");
    expect(presenceRoute).toContain("client_event_id");
    expect(attendanceRoute).toContain("client_event_id");
    expect(workforceSql).toContain("client_event_id uuid not null unique");
  });

  it("renders the approved status vocabulary and real attendance controls in the Office top bar", () => {
    expect(presenceControl).toContain("My status");
    expect(presenceControl).toContain("Check in");
    expect(presenceControl).toContain("Check out");
    expect(presenceControl).toContain("Start break");
    expect(presenceControl).toContain("Browser activity is never treated as payroll time");
  });
});
