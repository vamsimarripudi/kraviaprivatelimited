import { describe, expect, it } from "vitest";
import { financialYearFor, financialYearRange } from "../lib/corporate/financial-year";
import { hasCapability, requiresAal2 } from "../lib/corporate/permissions";

describe("Corporate Office permission model", () => {
  it("does not grant a CA unrestricted Board finalisation", () => {
    expect(hasCapability("CA", "meeting.finalize")).toBe(false);
    expect(hasCapability("CA_AUDITOR", "minutes.approve")).toBe(false);
  });
  it("requires MFA step-up for finalisation and publication", () => {
    expect(requiresAal2("meeting.finalize")).toBe(true);
    expect(requiresAal2("disclosure.publish")).toBe(true);
    expect(requiresAal2("compliance.view")).toBe(false);
  });
  it("keeps a director role able to view Board records", () => {
    expect(hasCapability("DIRECTOR", "meeting.view")).toBe(true);
  });
});

describe("Financial year utility", () => {
  it("uses the configured India-default April boundary for display only", () => {
    expect(financialYearFor(new Date("2026-03-31T12:00:00.000Z"))).toBe("FY 2025–26");
    expect(financialYearFor(new Date("2026-04-01T00:00:00.000Z"))).toBe("FY 2026–27");
    expect(financialYearRange("FY 2026–27")).toEqual({ start: "2026-04-01", end: "2027-03-31" });
  });
});
