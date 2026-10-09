import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const registrationRouteSource = readFileSync(new URL("../app/api/office-auth/register/route.ts", import.meta.url), "utf8");

describe("founder bootstrap publication policy", () => {
  it("keeps public founder bootstrap closed even when deployment configuration is present", () => {
    expect(registrationRouteSource).not.toContain("registerFounder");
    expect(registrationRouteSource).not.toContain("founderBootstrapIsPermitted");
    expect(registrationRouteSource).toContain("controlled operator bootstrap");
    expect(registrationRouteSource).toContain("status: 403");
  });
});
