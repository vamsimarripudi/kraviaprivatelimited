import { describe, expect, it } from "vitest";
import { isAutomationActionAllowed, stableEventKey } from "../lib/corporate/automation";
import { escapeCsvCell, findPotentialDuplicates, parseBankCsv } from "../lib/corporate/finance";

describe("automation safety", () => {
  it("uses a stable event identity and permits only safe automation actions", () => {
    expect(stableEventKey({ type: "document.expiring", entityType: "document", entityId: "a", correlationId: "b" })).toBe("document.expiring:document:a:b");
    expect(isAutomationActionAllowed({ type: "CREATE_NOTIFICATION", title: "Review", summary: "Review required" })).toBe(true);
  });
});

describe("finance import safety", () => {
  it("stages valid CSV rows and finds duplicate fingerprints", () => {
    const result = parseBankCsv("Date,Reference,Description,Debit,Credit,Balance\n2026-04-01,UTR-1,Vendor payment,1000,0,5000");
    expect(result.problems).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(findPotentialDuplicates(result.rows, new Set([result.rows[0].fingerprint]))).toEqual([2]);
  });
  it("rejects incomplete source rows and neutralises CSV formulas", () => {
    expect(parseBankCsv("Date,Description,Debit\n,,100").problems).toHaveLength(1);
    expect(escapeCsvCell("=HYPERLINK(\"https://bad.example\")")).toMatch(/^'/);
  });
});
