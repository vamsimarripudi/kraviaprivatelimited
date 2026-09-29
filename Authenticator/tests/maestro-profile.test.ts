import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const flow = (name: string) => readFileSync(new URL(`../.maestro/${name}`, import.meta.url), "utf8");

describe("Authenticator Maestro acceptance profile", () => {
  it("starts a fresh install on credential activation, not a camera or setup-key screen", () => {
    const source = flow("00-launch-lock.yaml");
    expect(source).toContain("clearState: true");
    expect(source).toContain('assertVisible: "Sign in to activate"');
    expect(source).toContain('assertVisible: "Corporate email"');
    expect(source).toContain('assertVisible: "Office password"');
    expect(source).not.toContain("QR");
    expect(source).not.toContain("setup key");
  });

  it("covers the Settings tab without weakening mandatory controls", () => {
    const source = flow("40-settings.after-unlock.yaml");
    expect(source).toContain('tapOn: "Settings"');
    expect(source).toContain('assertVisible: "Biometric Lock"');
    expect(source).toContain('assertVisible: "Lock on Background"');
    expect(source).toContain('assertVisible: "Clipboard Export"');
    expect(source).toContain('assertVisible: "Activation help"');
    expect(source).toContain('assertVisible: "App Version"');
  });
});
