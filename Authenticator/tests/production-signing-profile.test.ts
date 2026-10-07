import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getActionReferences,
  getSecretStepNames,
  getStep,
  parseReleaseWorkflow,
} from "./helpers/release-workflow";

const workflow = readFileSync(
  new URL("../../.github/workflows/authenticator-production.yml", import.meta.url),
  "utf8",
);
const script = readFileSync(
  new URL("../scripts/configure-production-android-signing.mjs", import.meta.url),
  "utf8",
);

const { document, job } = parseReleaseWorkflow(workflow, "production-android");

function expectImmutableActionPins() {
  const actionReferences = getActionReferences(job);
  expect(actionReferences).not.toHaveLength(0);
  for (const reference of actionReferences) {
    expect(reference).toMatch(/^[^@]+@[0-9a-f]{40}$/i);
  }
}

describe("KRAVIA Authenticator production signing contract", () => {
  it("is manual-only and never signs on normal repository pushes", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(job.if).toBe("github.ref == 'refs/heads/main'");
    expect(workflow).not.toContain("push:");
    expect(workflow).not.toContain("pull_request:");
  });

  it("requires protected keystore material rather than committing a signer", () => {
    for (const secret of [
      "KRAVIA_ANDROID_KEYSTORE_B64",
      "KRAVIA_ANDROID_KEYSTORE_PASSWORD",
      "KRAVIA_ANDROID_KEY_ALIAS",
      "KRAVIA_ANDROID_KEY_PASSWORD",
      "KRAVIA_AUTHENTICATOR_API_ORIGIN",
    ]) {
      expect(workflow).toContain(`secrets.${secret}`);
    }
    expect(workflow).toContain("kravia-authenticator-production");
    expect(workflow).toContain(
      "1008958AD5191C64DAA3D403C56B687B674C26913ACB8D86E2EF2971E8647B75",
    );
    expect(workflow).toContain("EXPO_PUBLIC_OFFICE_API_ORIGIN");
    expect(workflow).toContain("must be an HTTPS origin");
  });

  it("limits signing secrets to shell steps and pins all third-party actions", () => {
    expect(document.env).toBeUndefined();
    expect(job.env).toBeUndefined();
    expectImmutableActionPins();
    expect(getStep(job, "Validate protected signing inputs").env).toBeDefined();
    expect(getStep(job, "Materialize protected production keystore").env).toBeDefined();
    expect(getStep(job, "Remove production keystore").if).toBe("always()");
    expect(getSecretStepNames(job, "KRAVIA_ANDROID_KEYSTORE_B64")).toEqual([
      "Validate protected signing inputs",
      "Materialize protected production keystore",
    ]);
    expect(getSecretStepNames(job, "KRAVIA_ANDROID_KEYSTORE_PASSWORD")).toEqual([
      "Validate protected signing inputs",
      "Materialize protected production keystore",
      "Bind release build to protected KRAVIA signer",
      "Build production AAB and APK",
    ]);
    expect(getSecretStepNames(job, "KRAVIA_ANDROID_KEY_ALIAS")).toEqual([
      "Validate protected signing inputs",
      "Materialize protected production keystore",
      "Bind release build to protected KRAVIA signer",
      "Build production AAB and APK",
    ]);
    expect(getSecretStepNames(job, "KRAVIA_ANDROID_KEY_PASSWORD")).toEqual([
      "Validate protected signing inputs",
      "Bind release build to protected KRAVIA signer",
      "Build production AAB and APK",
    ]);
    expect(getSecretStepNames(job, "KRAVIA_AUTHENTICATOR_API_ORIGIN")).toEqual([
      "Validate protected signing inputs",
      "Generate Android native project",
      "Build production AAB and APK",
      "Verify production APK, manifest, API origin and signatures",
    ]);
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
    expect(script).toContain("storePassword kraviaStorePassword");
    expect(script).toContain("keyPassword kraviaKeyPassword");
    expect(script).not.toContain("KRAVIA_ANDROID_KEYSTORE_PASSWORD =");
    expect(script).not.toContain("KRAVIA_ANDROID_KEY_PASSWORD =");
  });
});
