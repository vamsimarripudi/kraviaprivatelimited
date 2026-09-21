import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const backendAuth = readFileSync(new URL("../../Backend/backend/identity_auth.py", import.meta.url), "utf8");
const authServer = readFileSync(new URL("../lib/office/auth-server.ts", import.meta.url), "utf8");
const passwordRoute = readFileSync(new URL("../app/api/office-auth/password/route.ts", import.meta.url), "utf8");
const recoveryRoute = readFileSync(new URL("../app/api/office-auth/recovery/password/route.ts", import.meta.url), "utf8");
const adminRecoveryRoute = readFileSync(new URL("../app/api/office-access/password-recovery/route.ts", import.meta.url), "utf8");
const resetPage = readFileSync(new URL("../app/office/reset-password/page.tsx", import.meta.url), "utf8");
const recoveryForm = readFileSync(new URL("../components/office-password-recovery-form.tsx", import.meta.url), "utf8");
const accessPanel = readFileSync(new URL("../components/access-governance-panel.tsx", import.meta.url), "utf8");
const securitySettings = readFileSync(new URL("../components/office-security-settings.tsx", import.meta.url), "utf8");

describe("KRAVIA Office password and recovery controls", () => {
  it("supports AAL2 self-service password change and revokes other sessions", () => {
    expect(backendAuth).toContain('@router.post("/password")');
    expect(backendAuth).toContain("require_aal2=True");
    expect(backendAuth).toContain("PASSWORD_CHANGED");
    expect(backendAuth).toContain("revoked_other_sessions");
    expect(authServer).toContain("changeOfficePassword");
    expect(passwordRoute).toContain("officeMutationIsSameOrigin");
    expect(passwordRoute).toContain('context.identity.aal !== "aal2"');
    expect(securitySettings).toContain("/api/office-auth/password");
    expect(securitySettings).toContain("Change password");
  });

  it("supports provider-free single-use administrator recovery links", () => {
    expect(backendAuth).toContain('@router.post("/users/{user_id}/recovery-link")');
    expect(backendAuth).toContain('"purpose": "password_recovery"');
    expect(backendAuth).toContain('"pwdv": _password_version(user)');
    expect(backendAuth).toContain("PASSWORD_RECOVERY_ISSUED");
    expect(backendAuth).toContain("OWNER recovery requires the protected break-glass procedure");
    expect(adminRecoveryRoute).toContain("officeMutationIsSameOrigin");
    expect(adminRecoveryRoute).toContain("issueOfficePasswordRecovery");
    expect(accessPanel).toContain("Issue recovery link");
    expect(accessPanel).toContain("Private recovery link");
  });

  it("completes recovery without email or SMS and invalidates the token by password version", () => {
    expect(backendAuth).toContain('@router.post("/recovery/password")');
    expect(backendAuth).toContain("Recovery link has already been used or superseded");
    expect(backendAuth).toContain("PASSWORD_RECOVERY_COMPLETED");
    expect(authServer).toContain("completeOfficePasswordRecovery");
    expect(recoveryRoute).toContain("clearOfficeSessionCookies");
    expect(recoveryRoute).toContain("officeMutationIsSameOrigin");
    expect(resetPage).toContain("OfficePasswordRecoveryForm");
    expect(resetPage).not.toContain('redirect("/office/recover")');
    expect(recoveryForm).toContain("/api/office-auth/recovery/password");
  });
});
