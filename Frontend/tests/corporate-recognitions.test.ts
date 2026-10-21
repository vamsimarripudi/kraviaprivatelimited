import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("public corporate recognition content", () => {
  it("uses the approved public identity source and keeps certificate copies private", () => {
    const source = readFileSync(resolve(process.cwd(), "components/corporate-recognitions.tsx"), "utf8");
    const registry = readFileSync(resolve(process.cwd(), "lib/corporate/public-registrations.ts"), "utf8");
    expect(source).toContain("getPublicCorporateRegistrations");
    expect(source.toLowerCase()).toContain("access-controlled corporate office");
    expect(registry).toContain("corporateIdentity");
    expect(registry).toContain("corporateIdentity.dpiit.statusLabel");
    expect(registry).toContain("corporateIdentity.udyam.classification");
    expect(registry).not.toContain("createClient");
  });
});
