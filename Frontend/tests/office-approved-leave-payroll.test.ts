import { describe, expect, it } from "vitest";
import { calculateVerifiedMonthlyAttendance, type ApprovedLeaveEvidence } from "../lib/office/attendance-salary-preview";
import type { ApprovedWorkSession } from "../lib/office/worktime-payroll-policy";

const employeeUserId = "employee";
const leave = (overrides: Partial<ApprovedLeaveEvidence> = {}): ApprovedLeaveEvidence => ({
  id: "leave-one", employeeUserId, status: "APPROVED",
  requestedBy: employeeUserId, reviewedBy: "independent-hr",
  startsOn: "2026-11-16", endsOn: "2026-11-16", payClass: "PAID_LEAVE",
  minutesPerWeekday: 360, ...overrides,
});
const worked = (startAt: string, endAt: string): ApprovedWorkSession => ({
  id: "actual-work", employeeUserId, startAt, endAt, reviewStatus: "APPROVED", reviewedBy: "independent-director",
});
const run = (leaveEvidence: ApprovedLeaveEvidence[], sessions: ApprovedWorkSession[] = []) =>
  calculateVerifiedMonthlyAttendance({ month: "2026-11", employeeUserId,
    monthlyGrossMinor: 5_000_000, sessions, leaveEvidence });

describe("approved paid/unpaid leave is verified payroll evidence", () => {
  it("treats one approved paid weekday as payable, not an automatic absence", () => {
    const result = run([leave()]);
    expect(result.approvedRegularMinutes).toBe(0);
    expect(result.approvedPaidLeaveMinutes).toBe(360);
    expect(result.approvedUnpaidLeaveMinutes).toBe(0);
    expect(result.unresolvedMinutes).toBe(20 * 360);
    expect(result.estimatedRegularGrossMinor).toBe(238095);
    expect(result.sourceLeaveIds).toEqual(["leave-one"]);
  });
  it("deducts independently approved unpaid leave but leaves undocumented days unresolved", () => {
    const result = run([leave({ payClass: "UNPAID_LEAVE" })]);
    expect(result.approvedUnpaidLeaveMinutes).toBe(360);
    expect(result.unresolvedMinutes).toBe(20 * 360);
    expect(result.estimatedRegularGrossMinor).toBe(0);
  });
  it("allows a documented half-day alongside three worked hours without double count", () => {
    const result = run([leave({ minutesPerWeekday: 180 })],
      [worked("2026-11-16T03:30:00Z","2026-11-16T06:30:00Z")]);
    expect(result.approvedRegularMinutes).toBe(180);
    expect(result.approvedPaidLeaveMinutes).toBe(180);
    expect(result.estimatedRegularGrossMinor).toBe(238095);
  });
  it("rejects full-day leave overlapping verified work and self-reviewed claims", () => {
    expect(() => run([leave()], [worked("2026-11-16T03:30:00Z","2026-11-16T09:30:00Z")]))
      .toThrow(/overlaps real worked hours/);
    expect(() => run([leave({ reviewedBy: employeeUserId })])).toThrow(/independently approved/);
    expect(() => run([leave({ reviewedBy: "another", requestedBy: "another" })])).toThrow(/independently approved/);
  });
  it("excludes weekends from ordinary paid and unpaid leave salary hours", () => {
    const result = run([leave({ startsOn: "2026-11-14", endsOn: "2026-11-15" })]);
    expect(result.approvedPaidLeaveMinutes).toBe(0);
    expect(result.sourceLeaveIds).toEqual([]);
  });
});
