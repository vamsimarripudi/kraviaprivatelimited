import { describe, expect, it } from "vitest";
import {
  calculateApprovedWorkPremiums, reconcileWageDebt, targetSalaryDate,
  agreedLateWageInterest, type ApprovedWorkPolicy, type ApprovedWorkSession,
} from "../lib/office/worktime-payroll-policy";

const policy: ApprovedWorkPolicy = {
  status: "APPROVED",
  authorityReference: "BOARD-APPROVED-WORK-RULES-2026",
  effectiveFrom: "2026-08-01",
  referenceMonthlyMinutes: 7_800,
  regularDailyMinutes: 360,
  weekdayOvertimeBasisPoints: 20_000,
  weekendBasisPoints: 30_000,
  nightPremiumBasisPoints: 2_000,
  nightStartsHour: 22,
  nightEndsHour: 6,
  weeklyTargetMinutes: 1_800,
  maxDailyMinutes: 600,
  maxWeeklyMinutes: 2_880,
};
const employeeUserId = "employee";
const reviewedBy = "director";
const item = (id: string, startAt: string, endAt: string, breaks: ApprovedWorkSession["breaks"] = []): ApprovedWorkSession =>
  ({ id, employeeUserId, startAt, endAt, breaks, reviewStatus: "APPROVED", reviewedBy });
const calculate = (sessions: ApprovedWorkSession[], gross = 4_000_000) =>
  calculateApprovedWorkPremiums({ month: "2026-08", employeeUserId, monthlyGrossMinor: gross, sessions, policy });

describe("KRAVIA six-hour/30-hour approved work policy", () => {
  it("never creates overtime from an approved six-hour weekday", () => {
    const result = calculate([item("wed", "2026-08-05T04:30:00Z", "2026-08-05T10:30:00Z")]);
    expect(result.weekdayBaseMinutes).toBe(360);
    expect(result.weekdayOvertimeMinutes).toBe(0);
    expect(result.totalAdditionalEarningsMinor).toBe(0);
  });

  it("pays only the hours over six on a weekday at 2x ordinary hourly rate", () => {
    const result = calculate([item("wed", "2026-08-05T04:30:00Z", "2026-08-05T12:30:00Z")]);
    expect(result.weekdayOvertimeMinutes).toBe(120);
    expect(result.weekdayOvertimeMinor).toBe(123_077); // Rs 1,230.77
    expect(result.weekendPremiumMinor).toBe(0);
  });

  it("pays all approved Saturday/Sunday hours at 3x without adding weekday 2x", () => {
    const result = calculate([item("sat", "2026-08-08T04:30:00Z", "2026-08-08T10:30:00Z")]);
    expect(result.weekendMinutes).toBe(360);
    expect(result.weekdayOvertimeMinutes).toBe(0);
    expect(result.weekendPremiumMinor).toBe(553_846); // Rs 5,538.46
  });

  it("splits a midnight-crossing weekend-night shift by IST calendar days", () => {
    const result = calculate([item("overnight", "2026-08-08T17:30:00Z", "2026-08-08T19:30:00Z")]); // 23:00 Sat - 01:00 Sun IST
    expect(result.weekendMinutes).toBe(120);
    expect(result.nightMinutes).toBe(120);
    expect(result.weekdayOvertimeMinutes).toBe(0);
    expect(result.weekendPremiumMinor).toBe(184_615);
    expect(result.nightPremiumMinor).toBe(12_308);
  });

  it("subtracts unpaid breaks, including minute offsets, before premium calculations", () => {
    const result = calculate([item("wed", "2026-08-05T04:30:00Z", "2026-08-05T12:30:00Z", [
      { startAt: "2026-08-05T07:30:00Z", endAt: "2026-08-05T08:00:00Z" },
    ])]);
    expect(result.workedMinutes).toBe(450);
    expect(result.weekdayOvertimeMinutes).toBe(90);
  });

  it("rejects self-approved, overlapping and invalid-break sessions", () => {
    expect(() => calculate([{ ...item("a","2026-08-05T04:30:00Z","2026-08-05T10:30:00Z"), reviewedBy: employeeUserId }])).toThrow(/independently approved/);
    expect(() => calculate([
      item("a","2026-08-05T04:30:00Z","2026-08-05T10:30:00Z"),
      item("b","2026-08-05T05:30:00Z","2026-08-05T07:30:00Z"),
    ])).toThrow(/Overlapping attendance/);
    expect(() => calculate([item("a","2026-08-05T04:30:00Z","2026-08-05T10:30:00Z", [
      { startAt: "2026-08-05T09:30:00Z", endAt: "2026-08-05T11:00:00Z" },
    ])])).toThrow(/invalid attendance break/);
  });

  it("earns a maximum of one monthly Flex Day after a full 30-hour Mon-Fri week", () => {
    const week1 = Array.from({ length: 5 }, (_, i) => item(String(i), 
      "2026-08-" + String(3 + i).padStart(2, "0") + "T04:30:00Z",
      "2026-08-" + String(3 + i).padStart(2, "0") + "T10:30:00Z"));
    const week2 = Array.from({ length: 5 }, (_, i) => item(String(i + 5),
      "2026-08-" + String(10 + i).padStart(2, "0") + "T04:30:00Z",
      "2026-08-" + String(10 + i).padStart(2, "0") + "T10:30:00Z"));
    const out = calculate([...week1, ...week2]);
    expect(out.flexDayEligibleWeeks).toHaveLength(2);
    expect(out.flexDaysEarnedThisMonth).toBe(1);
  });

  it("does not grant an extra paid day for 30 hours compressed into three weekdays", () => {
    const compressed = [3, 4, 5].map((date, i) => item("long-" + i,
      "2026-08-" + String(date).padStart(2, "0") + "T00:30:00Z",
      "2026-08-" + String(date).padStart(2, "0") + "T10:30:00Z",
      [{ startAt: "2026-08-" + String(date).padStart(2, "0") + "T04:30:00Z",
         endAt: "2026-08-" + String(date).padStart(2, "0") + "T05:00:00Z" }]));
    const result = calculate(compressed);
    expect(result.workedMinutes).toBe(1_710);
    expect(result.flexDaysEarnedThisMonth).toBe(0);
    expect(result.flexDayEligibleWeeks).toHaveLength(0);
  });

  it("uses the 30th or February 28th and moves weekend targets earlier", () => {
    expect(targetSalaryDate("2026-08").date).toBe("2026-08-28"); // 30th is Sunday
    expect(targetSalaryDate("2026-09").date).toBe("2026-09-30");
    expect(targetSalaryDate("2028-02").date).toBe("2028-02-28");
    expect(targetSalaryDate("2027-02").date).toBe("2027-02-26"); // 28th is Sunday
    expect(targetSalaryDate("2026-08").bankHolidayVerificationRequired).toBe(true);
  });

  it("keeps unpaid balances until confirmed bank settlements are recorded", () => {
    expect(reconcileWageDebt(4_000_000, [])).toEqual({ confirmedMinor: 0, balanceMinor: 4_000_000, status: "UNPAID" });
    expect(reconcileWageDebt(4_000_000, [1_500_000]).status).toBe("PARTIAL");
    expect(reconcileWageDebt(4_000_000, [1_500_000, 2_500_000]).status).toBe("PAID");
    expect(() => reconcileWageDebt(4_000_000, [4_000_001])).toThrow(/exceed/);
  });

  it("calculates late interest only with written company authority", () => {
    expect(agreedLateWageInterest({ balanceMinor: 4_000_000, daysOverdue: 30, annualRateBasisPoints: 1200,
      boardAuthorityReference: "Signed board policy" })).toBe(39_452);
    expect(() => agreedLateWageInterest({ balanceMinor: 4_000_000, daysOverdue: 30, annualRateBasisPoints: 1200,
      boardAuthorityReference: "" })).toThrow(/signed company interest policy/);
  });
});
