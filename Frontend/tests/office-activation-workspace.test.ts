import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

describe("Office activation and least-privilege leadership workspaces", () => {
  it("routes authenticated pending employees to a secure processing screen", () => {
    expect(read("lib/office/guard.ts")).toContain('redirect("/office/processing")');
    expect(read("app/office/processing/page.tsx")).toContain('ctx.identity.workspaceStatus');
    expect(read("components/office-workspace-processing.tsx")).toContain("Workspace is processing");
    expect(read("components/office-workspace-processing.tsx")).toContain("Request workspace activation");
  });
  it("requires Founder authority for approval and never exposes backend origin to the browser", () => {
    const route = read("app/api/office-access/workspace-activation/route.ts");
    expect(route).toContain('ctx.identity.roles.includes("OWNER")');
    expect(route).toContain("getOfficeRuntimeOrigin");
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(route).toContain("Cache-Control");
    expect(read("components/access-governance-panel.tsx")).toContain("Activate workspace");
    const auth = read("lib/office/auth-server.ts");
    expect(auth).toContain('identity.workspaceStatus === "ACTIVE"');
    expect(auth).toContain("officeIdentityCanAuthenticate");
    expect(read("app/api/office-auth/mfa/route.ts")).toContain("officeIdentityCanAuthenticate");
    expect(read("app/api/office-auth/invited-email-otp/route.ts")).toContain("officeIdentityCanAuthenticate");
  });
  it("limits navigation to active capability assignments, with an Owner oversight shortlist", () => {
    const shell = read("components/office-workspace-shell.tsx");
    const caps = read("lib/office/workspace-capabilities.ts");
    expect(shell).toContain("founderNavigation");
    expect(shell).toContain("office-floating-rail");
    expect(shell).toContain("capabilityCanAccessSection");
    expect(caps).toContain("personalOfficeSections.has(section)");
  });
});
