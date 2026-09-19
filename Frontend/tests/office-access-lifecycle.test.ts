import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authServer = readFileSync(new URL("../lib/office/auth-server.ts", import.meta.url), "utf8");
const accessAdmin = readFileSync(new URL("../lib/office/access-admin.ts", import.meta.url), "utf8");
const accessRecovery = readFileSync(new URL("../lib/office/access-recovery.ts", import.meta.url), "utf8");
const accessPanel = readFileSync(new URL("../components/access-governance-panel.tsx", import.meta.url), "utf8");
const backendAuth = readFileSync(new URL("../../Backend/backend/identity_auth.py", import.meta.url), "utf8");
const registerPage = readFileSync(new URL("../app/office/register/page.tsx", import.meta.url), "utf8");

describe("KRAVIA Office invitation lifecycle", () => {
  it("keeps public registration limited to a one-time locked Founder bootstrap", () => {
    expect(backendAuth).toContain('FOUNDER_SLOT = "PRIMARY_FOUNDER"');
    expect(backendAuth).toContain("Founder registration is permanently closed");
    expect(registerPage).toContain('mode="founder"');
    expect(registerPage).toContain("Founder registration has already been completed");
    expect(registerPage).toContain("private links issued inside KRAVIA Office");
  });

  it("issues single-use private registration links from the Office authority", () => {
    expect(accessAdmin).toContain('"/api/v1/auth/invitations"');
    expect(accessAdmin).toContain("registration_url");
    expect(accessPanel).toContain("Private registration link");
    expect(accessPanel).toContain("copyInviteLink");
    expect(accessPanel).toContain("send it only to the intended person");
    expect(backendAuth).toContain("registration_token");
    expect(backendAuth).toContain('invite.status = "ACCEPTED"');
  });

  it("does not use Supabase Auth administrative users, invitations or MFA reset", () => {
    expect(accessAdmin).not.toContain("admin.auth.admin");
    expect(accessRecovery).not.toContain("admin.auth.admin");
    expect(accessRecovery).not.toContain("office_accept_invitation");
    expect(accessRecovery).toContain("/api/v1/auth/users/");
    expect(authServer).not.toContain("verifyOtp");
  });

  it("preserves existing PostgreSQL role and authorization ledgers", () => {
    expect(backendAuth).toContain("office_identity_users");
    expect(backendAuth).toContain("office_user_roles");
    expect(backendAuth).toContain("office_access_invitations");
    expect(backendAuth).toContain("_mirror_identity");
  });
});
