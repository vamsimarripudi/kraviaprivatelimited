import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { founderBootstrapIsPermitted } from "../lib/office/bootstrap";

const registrationRouteSource = readFileSync(new URL("../app/api/office-auth/register/route.ts", import.meta.url), "utf8");

describe("founder bootstrap publication policy", () => {
  it("keeps founder credential creation closed unless a server-only deployment flag explicitly enables it", () => {
    expect(founderBootstrapIsPermitted({})).toBe(false);
    expect(founderBootstrapIsPermitted({ KRAVIA_ALLOW_FOUNDER_BOOTSTRAP: "false" })).toBe(false);
    expect(founderBootstrapIsPermitted({ KRAVIA_ALLOW_FOUNDER_BOOTSTRAP: "true" })).toBe(true);
  });

  it("enforces the founder-bootstrap gate in the server route before upstream registration", () => {
    expect(registrationRouteSource).toContain("founderBootstrapIsPermitted()");
    expect(registrationRouteSource).toContain("Founder registration is not available");
    expect(registrationRouteSource).toContain("status: 403");
  });
});
