import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../app/office/authenticator/page.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../components/workspace-login-form.tsx", import.meta.url), "utf8");
const authApi = readFileSync(new URL("../../Backend/backend/identity_auth.py", import.meta.url), "utf8");
const env = readFileSync(new URL("../.env.example", import.meta.url), "utf8");

describe("KRAVIA Authenticator Office boundary", () => {
  it("requires the authenticator path for the complete Office role catalog", () => {
    for (const role of ["OWNER","DIRECTOR","ADMIN","MEMBER","FINANCE","CA","CS","LEGAL","HR","OPERATIONS","AUDITOR","PRODUCT_ADMIN"]) {
      expect(login).toContain(`"${role}"`);
    }
    expect(login).toContain("MANDATORY MFA");
    expect(login).toContain("KRAVIA Authenticator is required for every Office role");
    expect(authApi).toContain('"mfa_policy": "AAL2_REQUIRED"');
    expect(authApi).toContain('"mfa_required_for_all_roles": True');
  });

  it("keeps the server and phone on one interoperable TOTP profile", () => {
    expect(authApi).toContain('MFA_AUTHENTICATOR_APP = "KRAVIA Authenticator"');
    expect(authApi).toContain('MFA_ISSUER = "KRAVIA Office"');
    expect(authApi).toContain('MFA_ALGORITHM = "SHA1"');
    expect(authApi).toContain("MFA_DIGITS = 6");
    expect(authApi).toContain("MFA_PERIOD_SECONDS = 30");
    expect(authApi).toContain("pyotp.random_base32()");
  });

  it("publishes truthful install guidance without inventing app-store availability", () => {
    expect(login).toContain('href="/office/authenticator"');
    expect(page).toContain("Install and enroll your phone");
    expect(page).toContain("Android network permission blocked");
    expect(page).toContain("no OTP clipboard export");
    expect(page).toContain("KRAVIA_AUTHENTICATOR_ANDROID_URL");
    expect(page).toContain("KRAVIA_AUTHENTICATOR_IOS_URL");
    expect(page).toContain("No public APK URL is exposed");
    expect(page).toContain("waits for an approved Apple signing");
    expect(env).toContain("KRAVIA_AUTHENTICATOR_ANDROID_URL=");
    expect(env).toContain("KRAVIA_AUTHENTICATOR_IOS_URL=");
  });
});
