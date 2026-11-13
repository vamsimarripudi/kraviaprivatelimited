import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertOfficeProductionFingerprint, OFFICE_RELEASE_URL } from "../scripts/verify-office-production-release.mjs";

const vercel = JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8")) as {
  git:{deploymentEnabled:Record<string,boolean>};
  ignoreCommand:string;
};
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
  it("requests just one production build after a completed Office merge",()=>{
    expect(vercel.git.deploymentEnabled.main).toBe(true);
    expect(vercel.git.deploymentEnabled["*"]).toBe(false);
    expect(vercel.ignoreCommand).toContain("feat(Office): complete KRAVIA Office release");
    expect(vercel.ignoreCommand).toContain("then exit 0;");
    expect(vercel.ignoreCommand).toContain("^deploy(frontend):");
    expect(vercel.ignoreCommand).toContain("then exit 1;");
    expect(vercel.ignoreCommand).toContain("git diff --quiet HEAD^ HEAD ./");
  });
});
