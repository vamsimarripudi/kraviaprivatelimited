import { describe, expect, it } from "vitest";
import { monthlyFlexibleWorktime, WORKTIME_HISTORY_START, WORKTIME_DAILY_ENFORCEMENT_START } from "../lib/office/flexible-worktime";

const now = Date.parse("2026-11-23T14:00:00Z"); // 19:30 IST
function session(id: string, day: string, from = "09:00", to = "15:00") {
  const start = Date.parse(day + "T" + from + ":00+05:30");
  const end = Date.parse(day + "T" + to + ":00+05:30");
  return { id, check_in_at: new Date(start).toISOString(), check_out_at: new Date(end).toISOString(), status: "CLOSED" };
}
function report(month: string, sessions: ReturnType<typeof session>[] = [], historicalClaims: Array<{
  id: string; work_starts_at: string; work_ends_at: string; status: string; source_kind: string; breaks: unknown;
}> = [], breaksBySession: Record<string, Array<{startAt: string; endAt: string}>> = {}) {
  return monthlyFlexibleWorktime({ month, now, sessions, historicalClaims, breaksBySession });
}
describe("KRAVIA flexible six-hour day and 30-hour week", () => {
  it("keeps the August 1 historical floor separate from Nov 14 live requirement", () => {
    const result = report("2026-08");
    expect(result.history_from).toBe(WORKTIME_HISTORY_START);
    expect(result.required_from).toBe(WORKTIME_DAILY_ENFORCEMENT_START);
    expect(result.day_records[0].date).toBe("2026-08-01");
    expect(result.day_records.every(day => day.status === "HISTORICAL" && day.daily_target_minutes === 0)).toBe(true);
  });
  it("counts six net hours regardless of clock-in time", () => {
    const morning = report("2026-11", [session("morning", "2026-11-16", "06:00", "12:00")]);
    const evening = report("2026-11", [session("evening", "2026-11-16", "13:00", "19:00")]);
    expect(morning.day_records.find(day => day.date === "2026-11-16")?.status).toBe("TARGET_MET");
    expect(evening.day_records.find(day => day.date === "2026-11-16")?.total_minutes).toBe(360);
  });
  it("calculates 30 hours across five weekdays and excludes Sat/Sun requirement", () => {
    const dates = ["2026-11-16","2026-11-17","2026-11-18","2026-11-19","2026-11-20"];
    const result = report("2026-11", dates.map((d, i) => session(String(i), d)));
    expect(result.weeks.find(w => w.monday === "2026-11-16")).toMatchObject({
      tracked_minutes: 1800, remaining_minutes: 0, status: "TARGET_MET",
    });
    expect(result.day_records.find(d => d.date === "2026-11-21")?.daily_target_minutes).toBe(0);
  });
  it("does not accept 30 weekly hours if one weekday has fewer than six", () => {
    const full = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"];
    const shifts = [
      ...full.map((day, i) => session("regular" + i, day, "09:00", "16:30")),
      session("missing", "2026-11-20", "09:00", "09:30"),
    ];
    const result = report("2026-11", shifts);
    const week = result.weeks.find(w => w.monday === "2026-11-16")!;
    expect(week.tracked_minutes).toBe(1830);
    expect(week.completed_weekdays).toBe(4);
    expect(week.status).toBe("IN_PROGRESS");
  });
  it("subtracts unpaid breaks and does not count browser login as attendance", () => {
    const s = session("break", "2026-11-16", "09:00", "16:00");
    const result = report("2026-11", [s], [], {
      break: [{ startAt: "2026-11-16T07:30:00Z", endAt: "2026-11-16T08:30:00Z" }],
    });
    const day = result.day_records.find(d => d.date === "2026-11-16")!;
    expect(day.total_minutes).toBe(360);
    expect(day.potential_overtime_minutes).toBe(0);
    const missing = result.day_records.find(d => d.date === "2026-11-17")!;
    expect(missing.status).toBe("NOT_RECORDED");
    expect(missing.total_minutes).toBe(0);
  });
  it("includes only APPROVED historical claims and avoids double counting overlaps", () => {
    const s = session("recorded", "2026-11-16");
    const base = {
      work_starts_at: s.check_in_at, work_ends_at: s.check_out_at,
      source_kind: "HISTORICAL_CORRECTION", breaks: [],
    };
    const result = report("2026-11", [s], [
      { ...base, id: "confirmed", status: "APPROVED" },
      { ...base, id: "pending", status: "PENDING" },
    ]);
    expect(result.day_records.find(d => d.date === "2026-11-16")?.total_minutes).toBe(360);
    expect(result.approved_historical_minutes).toBe(360);
    expect(result.total_minutes).toBe(360);
  });
  it("treats overtime as a candidate, never as an authorised salary", () => {
    const result = report("2026-11", [session("long", "2026-11-16", "09:00", "17:00")]);
    const day = result.day_records.find(d => d.date === "2026-11-16")!;
    expect(day.potential_overtime_minutes).toBe(120);
    expect(result.message).toContain("not approved or paid");
  });
  it("does not declare cross-month boundary weeks short without the adjacent month", () => {
    const result = report("2026-11", [session("boundary", "2026-11-30")]);
    const week = result.weeks.find(w => w.monday === "2026-11-30");
    expect(week).toBeUndefined(); // Future relative to the explicit as-of time.
    const earlier = result.weeks.find(w => w.monday === "2026-11-02")!;
    expect(earlier.target_minutes).toBe(0); // Before the operational commencement.
  });
  it("uses IST day boundaries for overnight work instead of server UTC date", () => {
    const s = {id: "cross", status: "CLOSED", check_in_at:"2026-11-16T17:30:00Z", check_out_at:"2026-11-16T19:30:00Z"};
    const result = report("2026-11", [s]);
    expect(result.day_records.find(d => d.date === "2026-11-16")?.total_minutes).toBe(60);
    expect(result.day_records.find(d => d.date === "2026-11-17")?.total_minutes).toBe(60);
  });
});
