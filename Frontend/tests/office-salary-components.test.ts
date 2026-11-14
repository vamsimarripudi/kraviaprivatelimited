import { describe, expect, it } from "vitest";
import { parseRoleCompensationSplit } from "../lib/office/salary-components";

describe("KRAVIA multi-role gross compensation without double count", () => {
  it("keeps Founder/CTO 50k and developer 70k as one 120k monthly package", () => {
    const result = parseRoleCompensationSplit("Founder & CTO | 50000\nFull Stack Developer | 70000", 12_000_000);
    expect(result).toHaveLength(2);
    expect(result.map(item => item.amount_minor)).toEqual([5_000_000, 7_000_000]);
    expect(result.every(item => item.kind === "OTHER" && item.metadata.non_additive)).toBe(true);
  });
  it("does not treat two full salaries as additive to an already paid base salary", () => {
    expect(() => parseRoleCompensationSplit("Founder & CTO | 50000\nDeveloper | 70000", 5_000_000)).toThrow(/single approved monthly gross/);
  });
  it("accepts no split and rejects ambiguity, duplicates and fractional paise", () => {
    expect(parseRoleCompensationSplit("", 4_000_000)).toEqual([]);
    expect(() => parseRoleCompensationSplit("CTO 50000", 5_000_000)).toThrow(/Role title/);
    expect(() => parseRoleCompensationSplit("CTO | 50000\ncto | 0", 5_000_000)).toThrow(/Duplicate/);
    expect(() => parseRoleCompensationSplit("CTO | 50000.001", 5_000_000)).toThrow(/Role title/);
  });
});
