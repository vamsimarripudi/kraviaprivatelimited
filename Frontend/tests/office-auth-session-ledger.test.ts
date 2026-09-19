import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authModels = readFileSync(new URL("../../Backend/backend/auth_models.py", import.meta.url), "utf8");
const authApi = readFileSync(new URL("../../Backend/backend/identity_auth.py", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../Backend/backend/migrations/versions/a41f3c9e5d20_v10_first_party_office_identity.py", import.meta.url), "utf8");
const authServer = readFileSync(new URL("../lib/office/auth-server.ts", import.meta.url), "utf8");
const signInRoute = readFileSync(new URL("../app/api/office-auth/sign-in/route.ts", import.meta.url), "utf8");
const mfaRoute = readFileSync(new URL("../app/api/office-auth/mfa/route.ts", import.meta.url), "utf8");
const registerRoute = readFileSync(new URL("../app/api/office-auth/register/route.ts", import.meta.url), "utf8");

describe("KRAVIA Office first-party identity boundary", () => {
  it("stores only password hashes and refresh-token hashes in the canonical database", () => {
    expect(authModels).toContain('password_hash = Column(String(512)');
    expect(authModels).toContain('refresh_token_hash = Column(String(64)');
    expect(authModels).not.toContain("refresh_token = Column");
    expect(authModels).not.toContain("access_token = Column");
    expect(authApi).toContain("PASSWORD_HASHER = PasswordHasher");
    expect(authApi).toContain("argon2");
  });

  it("keeps first-party identity tables closed to browser database roles", () => {
    expect(migration).toContain("office_auth_users");
    expect(migration).toContain("office_auth_sessions_v2");
    expect(migration).toContain("office_auth_invites");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table");
  });

  it("keeps provider tokens server-side in HttpOnly same-site cookies", () => {
    expect(authServer).toContain('OFFICE_ACCESS_COOKIE = "kravia_office_access"');
    expect(authServer).toContain('OFFICE_REFRESH_COOKIE = "kravia_office_refresh"');
    expect(authServer).toMatch(/httpOnly:\s*true/);
    expect(authServer).toMatch(/sameSite:\s*"strict"/);
    expect(signInRoute).not.toContain("access_token:");
    expect(registerRoute).not.toContain("access_token:");
  });

  it("requires KRAVIA first-party MFA before workspace access", () => {
    expect(authApi).toContain('session.aal = "aal2"');
    expect(authApi).toContain("pyotp.TOTP");
    expect(authApi).toContain("_encrypt_mfa_secret");
    expect(mfaRoute).toContain("verifyOfficeMfa");
    expect(mfaRoute).not.toContain("context.client.auth");
  });

  it("does not use Supabase Auth in the active BFF identity flow", () => {
    expect(authServer).not.toContain("createClient");
    expect(authServer).not.toContain(".auth.");
    expect(signInRoute).not.toContain("Supabase");
    expect(mfaRoute).not.toContain("Supabase");
    expect(registerRoute).not.toContain("Supabase");
  });
});
