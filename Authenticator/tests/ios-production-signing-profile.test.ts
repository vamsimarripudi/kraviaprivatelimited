import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getActionReferences,
  getSecretStepNames,
  getStep,
  parseReleaseWorkflow,
} from "./helpers/release-workflow";

const workflow = readFileSync(
  new URL("../../.github/workflows/authenticator-production-ios.yml", import.meta.url),
  "utf8",
);
const doc = readFileSync(
  new URL("../IOS_PRODUCTION_SIGNING.md", import.meta.url),
  "utf8",
);

const { document, job } = parseReleaseWorkflow(workflow, "production-ios");

function expectImmutableActionPins() {
  const actionReferences = getActionReferences(job);
  expect(actionReferences).not.toHaveLength(0);
  for (const reference of actionReferences) {
    expect(reference).toMatch(/^[^@]+@[0-9a-f]{40}$/i);
  }
}

describe("KRAVIA Authenticator iOS production signing contract", () => {
  it("is manual-only and uses a macOS signing runner", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(job.if).toBe("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("runs-on: macos-latest");
    expect(workflow).not.toContain("push:");
    expect(workflow).not.toContain("pull_request:");
  });

  it("requires protected Apple signing material", () => {
    for (const secret of [
      "KRAVIA_IOS_DISTRIBUTION_P12_B64",
      "KRAVIA_IOS_DISTRIBUTION_P12_PASSWORD",
      "KRAVIA_IOS_PROVISION_PROFILE_B64",
      "KRAVIA_IOS_TEAM_ID",
      "KRAVIA_AUTHENTICATOR_API_ORIGIN",
    ]) {
      expect(workflow).toContain(`secrets.${secret}`);
    }
    expect(workflow).toContain("Apple Distribution");
    expect(workflow).toContain("EXPO_PUBLIC_OFFICE_API_ORIGIN");
  });

  it("limits Apple signing secrets to shell steps and pins all third-party actions", () => {
    expect(document.env).toBeUndefined();
    expect(job.env).toBeUndefined();
    expectImmutableActionPins();
    expect(getStep(job, "Validate protected iOS signing inputs").env).toBeDefined();
    expect(getStep(job, "Import Apple distribution identity").env).toBeDefined();
    expect(getStep(job, "Remove temporary signing material").if).toBe("always()");
    expect(workflow).toContain(
      'rm -f "$HOME/Library/MobileDevice/Provisioning Profiles/$KRAVIA_IOS_PROFILE_UUID.mobileprovision"',
    );
    expect(getSecretStepNames(job, "KRAVIA_IOS_DISTRIBUTION_P12_B64")).toEqual([
      "Validate protected iOS signing inputs",
      "Import Apple distribution identity",
    ]);
    expect(getSecretStepNames(job, "KRAVIA_IOS_DISTRIBUTION_P12_PASSWORD")).toEqual([
      "Validate protected iOS signing inputs",
      "Import Apple distribution identity",
    ]);
    expect(getSecretStepNames(job, "KRAVIA_IOS_PROVISION_PROFILE_B64")).toEqual([
      "Validate protected iOS signing inputs",
      "Import Apple distribution identity",
    ]);
    expect(getSecretStepNames(job, "KRAVIA_IOS_TEAM_ID")).toEqual([
      "Validate protected iOS signing inputs",
      "Import Apple distribution identity",
      "Archive signed KRAVIA Authenticator",
      "Export signed IPA",
      "Verify signed IPA identity and provisioning",
      "Record iOS production build evidence",
    ]);
    expect(getSecretStepNames(job, "KRAVIA_AUTHENTICATOR_API_ORIGIN")).toEqual([
      "Validate protected iOS signing inputs",
      "Generate native iOS project",
      "Archive signed KRAVIA Authenticator",
    ]);
  });

  it("pins the KRAVIA bundle identity and verifies the exported IPA", () => {
    expect(workflow).toContain("com.kraviaprivatelimited.authenticator");
    expect(workflow).toContain("codesign --verify --deep --strict");
    expect(workflow).toContain("CFBundleIdentifier");
    expect(workflow).toContain("CFBundleShortVersionString");
    expect(workflow).toContain("CFBundleVersion");
    expect(workflow).toContain("embedded.mobileprovision");
    expect(workflow).toContain("SHA256SUMS.txt");
  });

  it("keeps Apple provider approval outside repository claims", () => {
    expect(doc).toContain("Apple provider boundary");
    expect(doc).toContain("not evidence of App Store/TestFlight approval");
    expect(doc).toContain("does not store Apple signing certificates");
  });
});
