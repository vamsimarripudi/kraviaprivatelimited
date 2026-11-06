import { describe, expect, it } from "vitest";
import { DIWALI_END_UTC, DIWALI_START_UTC, isDiwaliActive } from "../components/diwali-window";

describe("24-hour Diwali celebration window (IST)", () => {
  it("opens at midnight November 8 in India, not before", () => {
    expect(isDiwaliActive(DIWALI_START_UTC - 1)).toBe(false);
    expect(isDiwaliActive(DIWALI_START_UTC)).toBe(true);
  });
  it("closes at midnight November 9 in India", () => {
    expect(DIWALI_END_UTC - DIWALI_START_UTC).toBe(24 * 60 * 60 * 1000);
    expect(isDiwaliActive(DIWALI_END_UTC - 1)).toBe(true);
    expect(isDiwaliActive(DIWALI_END_UTC)).toBe(false);
  });
});
