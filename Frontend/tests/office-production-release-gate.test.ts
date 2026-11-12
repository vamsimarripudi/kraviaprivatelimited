import { describe, expect, it } from "vitest";
import { assertOfficeProductionFingerprint, OFFICE_RELEASE_URL } from "../scripts/verify-office-production-release.mjs";

const sha = "0123456789abcdef0123456789abcdef01234567";
const valid = { application:"KRAVIA Office", environment:"production", release:"test", commit:sha.slice(0,12) };

describe("KRAVIA Office verified single production release", () => {
  it("requires the real custom domain and the exact approved commit", () => {
    expect(OFFICE_RELEASE_URL).toBe("https://www.kraviaprivatelimited.com/api/office-release");
    expect(assertOfficeProductionFingerprint(valid,sha).valid).toBe(true);
  });
  it("fails hard for ignored builds, wrong environments and stale versions", () => {
    expect(() => assertOfficeProductionFingerprint({...valid,commit:"5dc08888a62b"},sha)).toThrow("not serving");
    expect(() => assertOfficeProductionFingerprint({...valid,environment:"preview"},sha)).toThrow("production");
    expect(() => assertOfficeProductionFingerprint({...valid,application:"Another product"},sha)).toThrow("KRAVIA Office");
    expect(() => assertOfficeProductionFingerprint(valid,"0123")).toThrow("40-character");
  });
});
