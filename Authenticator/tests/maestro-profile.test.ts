import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const flow = (name: string) => readFileSync(new URL(`../.maestro/${name}`, import.meta.url), "utf8");

describe("KRAVIA Authenticator Maestro acceptance profile", () => {
  it("starts with a welcome note, then asks for registered credentials", () => {
    const source = flow("00-launch-lock.yaml");
    expect(source).toContain("clearState: true");
    expect(source).toContain('assertVisible: "Welcome to"');
    expect(source).toContain('tapOn: "Get started"');
    expect(source).toContain('assertVisible: "Sign in"');
    expect(source).toContain('assertVisible: "Corporate email"');
    expect(source).toContain('assertVisible: "Password"');
  });

  it("keeps QR and setup-key enrollment out of the entry journey", () => {
    const source = flow("00-launch-lock.yaml");
    expect(source).not.toContain("QR");
    expect(source).not.toContain("setup key");
  });
});
