import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { financeSections, officeSections, roleCanAccessSection, roleCanAccessWorkspace } from "../lib/office/workspaces";
import { officeMutationIsSameOrigin } from "../lib/office/request-security";

const proxySource = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const authServerSource = readFileSync(new URL("../lib/office/auth-server.ts", import.meta.url), "utf8");
const signInSource = readFileSync(new URL("../app/api/office-auth/sign-in/route.ts", import.meta.url), "utf8");
const runtimeProxySource = readFileSync(new URL("../app/api/office-runtime/[...path]/route.ts", import.meta.url), "utf8");
const accessAdminSource = readFileSync(new URL("../lib/office/access-admin.ts", import.meta.url), "utf8");
const activationSource = readFileSync(new URL("../components/workspace-activation-form.tsx", import.meta.url), "utf8");

describe("KRAVIA path-based internal workspaces", () => {
  it("routes employees/governance roles to Office and finance professionals to Finance", () => {
    expect(roleCanAccessWorkspace("office", ["OWNER"])).toBe(true);
    expect(roleCanAccessWorkspace("office", ["ADMIN"])).toBe(true);
    expect(roleCanAccessWorkspace("office", ["MEMBER"])).toBe(true);
    expect(roleCanAccessWorkspace("office", ["HR"])).toBe(true);
    expect(roleCanAccessWorkspace("office", ["CA"])).toBe(false);
    expect(roleCanAccessWorkspace("finance", ["CA"])).toBe(true);
    expect(roleCanAccessWorkspace("finance", ["AUDITOR"])).toBe(true);
    expect(roleCanAccessWorkspace("finance", ["ADMIN"])).toBe(false);
    expect(roleCanAccessWorkspace("finance", ["HR"])).toBe(false);
  });

  it("keeps sensitive modules narrower than workspace membership", () => {
    expect(roleCanAccessSection(financeSections.gst, ["CA"])).toBe(true);
    expect(roleCanAccessSection(financeSections.audit, ["AUDITOR"])).toBe(true);
    expect(roleCanAccessSection(financeSections.ownership, ["CA"])).toBe(false);
    expect(roleCanAccessSection(financeSections.ownership, ["OWNER"])).toBe(true);
    expect(roleCanAccessSection(officeSections.access, ["ADMIN"])).toBe(true);
    expect(roleCanAccessSection(officeSections.documents, ["ADMIN"])).toBe(false);
    expect(roleCanAccessSection(officeSections.people, ["MEMBER"])).toBe(false);
    expect(roleCanAccessSection(officeSections.people, ["HR"])).toBe(true);
    expect(roleCanAccessSection(officeSections.security, ["HR"])).toBe(false);
  });

  it("redirects legacy corporate paths without coupling website admin to Office auth", () => {
    expect(proxySource).toContain('login: "/office/login"');
    expect(proxySource).toContain('finance: "/finance"');
    expect(proxySource).toContain('gst: "/finance/gst"');
    expect(proxySource).toContain('content: "/admin/newsroom"');
    expect(proxySource).toContain('matcher: ["/corporate/:path*", "/admin/:path*"]');
  });

  it("keeps Office session tokens in server-managed HttpOnly strict cookies", () => {
    expect(authServerSource).toMatch(/httpOnly\s*:\s*true/);
    expect(authServerSource).toMatch(/sameSite\s*:\s*"strict"/);
    expect(authServerSource).toMatch(/OFFICE_ACCESS_COOKIE\s*=\s*"kravia_office_access"/);
    expect(authServerSource).toMatch(/OFFICE_REFRESH_COOKIE\s*=\s*"kravia_office_refresh"/);
    expect(signInSource).not.toContain('"access_token"');
    expect(signInSource).not.toContain('"refresh_token"');
  });

  it("uses trusted server administration and authoritative role rechecks", () => {
    expect(authServerSource).toContain("OFFICE_SUPABASE_SECRET_KEY");
    expect(authServerSource).toContain("resolveAuthoritativeIdentity");
    expect(accessAdminSource).toContain("inviteUserByEmail");
    expect(accessAdminSource).toContain("AAL2 verification is required");
    expect(accessAdminSource).not.toContain("NEXT_PUBLIC_SUPABASE_SECRET");
  });

  it("requires strong invite activation password and MFA", () => {
    expect(activationSource).toContain("password.length >= 14");
    expect(activationSource).toContain('/api/office-auth/mfa');
    expect(activationSource).toContain('Verify and enter workspace');
  });

  it("rejects cross-origin Office browser mutations", () => {
    const sameOrigin = new Request("https://kraviaprivatelimited.com/api/office-auth/sign-in", { method: "POST", headers: { Origin: "https://kraviaprivatelimited.com", "Sec-Fetch-Site": "same-origin" } });
    const crossOrigin = new Request("https://kraviaprivatelimited.com/api/office-auth/sign-in", { method: "POST", headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" } });
    expect(officeMutationIsSameOrigin(sameOrigin)).toBe(true);
    expect(officeMutationIsSameOrigin(crossOrigin)).toBe(false);
  });

  it("keeps the FastAPI origin server-only and blocks sensitive provider callback paths", () => {
    expect(runtimeProxySource).toContain('getOfficeRuntimeOrigin()');
    expect(runtimeProxySource).toContain('headers.set("Authorization", `Bearer ${session.session.access_token}`)');
    expect(runtimeProxySource).toContain('"finance/webhooks"');
    expect(runtimeProxySource).toContain('redirect: "manual"');
    expect(runtimeProxySource).toContain("MAX_BODY_BYTES");
    expect(runtimeProxySource).toContain("officeMutationIsSameOrigin(request)");
  });
});
