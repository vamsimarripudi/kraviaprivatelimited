import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const flow = (name: string) =>
  readFileSync(new URL(`../.maestro/${name}`, import.meta.url), "utf8");

describe("KRAVIA Authenticator Maestro acceptance profile", () => {
  it("keeps cold launch behind the local-auth boundary", () => {
    const source = flow("00-launch-lock.yaml");
    expect(source).toContain("clearState: true");
    expect(source).toContain('assertVisible: "Unlock authenticator"');
    expect(source).toContain("No password · No network · No clipboard export");
  });

  it("uses only non-production enrollment fixtures", () => {
    const source = flow("10-manual-enrollment.after-unlock.yaml");
    expect(source).toContain("qa@kraviaprivatelimited.com");
    expect(source).toContain("JBSWY3DPEHPK3PXP");
    expect(source).toContain('assertVisible: "Clipboard export is disabled."');
  });

  it("regression-tests rejection of non-corporate manual enrollment", () => {
    const source = flow("11-invalid-enrollment.after-unlock.yaml");
    expect(source).toContain("qa@example.com");
    expect(source).toContain("KRAVIA enrollment must use a corporate kraviaprivatelimited.com account");
  });
});
