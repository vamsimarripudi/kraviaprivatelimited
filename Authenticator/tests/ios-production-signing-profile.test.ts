import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../.github/workflows/authenticator-production-ios.yml", import.meta.url),
  "utf8",
);
const doc = readFileSync(
  new URL("../IOS_PRODUCTION_SIGNING.md", import.meta.url),
  "utf8",
);

describe("KRAVIA Authenticator iOS production signing contract", () => {
  it("is manual-only and uses a macOS signing runner", () => {
    expect(workflow).toContain("workflow_dispatch:");
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
    ]) {
      expect(workflow).toContain(`secrets.${secret}`);
    }
    expect(workflow).toContain("Apple Distribution");
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
