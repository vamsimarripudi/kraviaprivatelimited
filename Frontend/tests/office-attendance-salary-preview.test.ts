import { describe, expect, it } from "vitest";
import { calculateVerifiedMonthlyAttendance } from "../lib/office/attendance-salary-preview";
import type { ApprovedWorkSession } from "../lib/office/worktime-payroll-policy";

const employeeUserId = "employee";
const shift = (id: string, startAt: string, endAt: string, breaks: ApprovedWorkSession["breaks"] = []): ApprovedWorkSession =>
  ({ id, employeeUserId, startAt, endAt, breaks, reviewStatus: "APPROVED", reviewedBy: "hr-reviewer" });
const calculate = (sessions: ApprovedWorkSession[], monthlyGrossMinor: number | null = 5_000_000) =>
  calculateVerifiedMonthlyAttendance({ month: "2026-11", employeeUserId, monthlyGrossMinor, sessions });

describe("auditable monthly HR salary preview", () => {
  it("prices approved regular weekday hours, but never calls missing work an absence", () => {
    const result = calculate([shift("monday", "2026-11-16T03:30:00Z", "2026-11-16T09:30:00Z")]);
    expect(result.scheduledWeekdays).toBe(21);
    expect(result.basisMinutes).toBe(21 * 360);
    expect(result.approvedRegularMinutes).toBe(360);
    expect(result.unresolvedMinutes).toBe(20 * 360);
    expect(result.estimatedRegularGrossMinor).toBe(238095);
    expect(result.readyForPayroll).toBe(false);
  });
  it("splits approved overnight shifts at midnight in IST and excludes weekends from base", () => {
    const preview = calculate([shift("overnight", "2026-11-15T17:30:00Z", "2026-11-15T20:30:00Z")]);
    expect(preview.optionalWeekendMinutes).toBe(60);
    expect(preview.approvedRegularMinutes).toBe(120);
  });
  it("does not double-pay over six weekday hours or unpaid breaks", () => {
    const preview = calculate([shift("ot", "2026-11-16T03:30:00Z", "2026-11-16T12:30:00Z", [
      { startAt: "2026-11-16T06:30:00Z", endAt: "2026-11-16T07:30:00Z" },
    ])]);
    expect(preview.approvedRegularMinutes).toBe(360);
    expect(preview.potentialWeekdayOvertimeMinutes).toBe(120);
  });
  it("never estimates payroll from self-approved, overlapping or unapproved entries", () => {
    const valid = shift("one", "2026-11-16T03:30:00Z", "2026-11-16T09:30:00Z");
    expect(() => calculate([{ ...valid, reviewedBy: employeeUserId }])).toThrow(/independently verified/);
    expect(() => calculate([{ ...valid, reviewStatus: "PENDING" as "APPROVED" }])).toThrow();
    expect(() => calculate([valid, shift("two", "2026-11-16T04:00:00Z", "2026-11-16T07:30:00Z")])).toThrow(/Overlapping approved/);
    expect(() => calculate([shift("bad", "2026-11-16T03:30:00Z", "2026-11-16T09:30:00Z", [
      { startAt: "2026-11-16T02:30:00Z", endAt: "2026-11-16T04:30:00Z" },
    ])])).toThrow(/unpaid break/);
  });
  it("requires approved compensation before producing a currency estimate", () => {
    expect(calculate([], null).estimatedRegularGrossMinor).toBeNull();
    expect(calculate([], null).readyForPayroll).toBe(false);
  });
});
