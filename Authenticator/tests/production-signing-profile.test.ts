import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../.github/workflows/authenticator-production.yml", import.meta.url),
  "utf8",
);
const script = readFileSync(
  new URL("../scripts/configure-production-android-signing.mjs", import.meta.url),
  "utf8",
);

describe("KRAVIA Authenticator production signing contract", () => {
  it("is manual-only and never signs on normal repository pushes", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("push:");
    expect(workflow).not.toContain("pull_request:");
  });

  it("requires protected keystore material rather than committing a signer", () => {
    for (const secret of [
      "KRAVIA_ANDROID_KEYSTORE_B64",
      "KRAVIA_ANDROID_KEYSTORE_PASSWORD",
      "KRAVIA_ANDROID_KEY_ALIAS",
      "KRAVIA_ANDROID_KEY_PASSWORD",
    ]) {
      expect(workflow).toContain(`secrets.${secret}`);
    }
    expect(workflow).toContain("kravia-authenticator-production");
    expect(workflow).toContain(
      "1008958AD5191C64DAA3D403C56B687B674C26913ACB8D86E2EF2971E8647B75",
    );
  });

  it("builds both Play AAB and installable APK and verifies their signer", () => {
    expect(workflow).toContain("bundleRelease assembleRelease");
    expect(workflow).toContain("apksigner");
    expect(workflow).toContain("jarsigner -verify -strict");
    expect(workflow).toContain("keytool -printcert -jarfile");
    expect(workflow).toContain("SHA256SUMS.txt");
  });

  it("keeps release credentials in runner environment only", () => {
    expect(script).toContain('System.getenv("KRAVIA_ANDROID_KEYSTORE_PATH")');
    expect(script).toContain('System.getenv("KRAVIA_ANDROID_KEYSTORE_PASSWORD")');
    expect(script).toContain('System.getenv("KRAVIA_ANDROID_KEY_ALIAS")');
    expect(script).toContain('System.getenv("KRAVIA_ANDROID_KEY_PASSWORD")');
    expect(script).toContain("signingConfig signingConfigs.release");
    expect(script).not.toMatch(/storePassword\s+['"][^'"]+['"]/);
    expect(script).not.toMatch(/keyPassword\s+['"][^'"]+['"]/);
  });
});
