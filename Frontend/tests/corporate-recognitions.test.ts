import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("public corporate recognition content", () => {
  it("uses only the database public projection and keeps certificate copies private", () => {
    const source = readFileSync(resolve(process.cwd(), "components/corporate-recognitions.tsx"), "utf8");
    const registry = readFileSync(resolve(process.cwd(), "lib/corporate/public-registrations.ts"), "utf8");
    expect(source).toContain("getPublicCorporateRegistrations");
    expect(source.toLowerCase()).toContain("access-controlled corporate office");
    expect(registry).toContain("public_corporate_facts");
    expect(registry).toContain("startup_india_recognition");
    expect(registry).toContain("udyam_registration");
  });
});