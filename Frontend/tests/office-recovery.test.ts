import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authServerSource = readFileSync(new URL("../lib/office/auth-server.ts", import.meta.url), "utf8");
const requestSource = readFileSync(new URL("../app/api/office-auth/recovery/request/route.ts", import.meta.url), "utf8");
const confirmSource = readFileSync(new URL("../app/office/recover/confirm/route.ts", import.meta.url), "utf8");
const passwordSource = readFileSync(new URL("../app/api/office-auth/recovery/password/route.ts", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("../app/office/login/page.tsx", import.meta.url), "utf8");

describe("KRAVIA Office password recovery", () => {
  it("uses a short-lived signed HttpOnly recovery authorization", () => {
    expect(authServerSource).toContain('OFFICE_RECOVERY_COOKIE = "kravia_office_recovery"');
    expect(authServerSource).toContain('createHmac("sha256"');
    expect(authServerSource).toContain('RECOVERY_MAX_AGE_SECONDS = 60 * 15');
    expect(authServerSource).toMatch(/httpOnly:\s*true/);
    expect(authServerSource).toMatch(/sameSite:\s*"strict"/);
  });

  it("exchanges a server-side recovery token hash rather than browser URL fragments", () => {
    expect(confirmSource).toContain('searchParams.get("token_hash")');
    expect(confirmSource).toContain('type !== "recovery"');
    expect(authServerSource).toContain('type: "recovery"');
    expect(confirmSource).not.toContain("access_token");
    expect(confirmSource).not.toContain("refresh_token");
  });

  it("keeps recovery initiation same-origin and bound to the canonical frontend", () => {
    expect(requestSource).toContain("officeMutationIsSameOrigin(request)");
    expect(requestSource).toContain("NEXT_PUBLIC_SITE_URL");
    expect(requestSource).toContain('new URL("/office/reset-password", origin)');
    expect(authServerSource).toContain("resetPasswordForEmail");
  });

  it("revokes Office sessions after a successful password reset", () => {
    expect(passwordSource).toContain("officeRecoveryIsVerified");
    expect(passwordSource).toContain('signOutOffice(context, "global")');
    expect(passwordSource).toContain("updateUser({ password:");
  });

  it("exposes recovery from the Office sign-in screen without weakening invitation-only onboarding", () => {
    expect(loginSource).toContain('href="/office/recover"');
    expect(loginSource).toContain("Recover Office access");
    expect(loginSource).toContain("password_reset");
    expect(loginSource).toContain("recovery_invalid");
  });
});
