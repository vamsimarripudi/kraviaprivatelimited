import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../../Authenticator/App.tsx", import.meta.url), "utf8");
const provisioning = readFileSync(new URL("../../Authenticator/src/provisioning.ts", import.meta.url), "utf8");
const storage = readFileSync(new URL("../../Authenticator/src/storage.ts", import.meta.url), "utf8");
const security = readFileSync(new URL("../../Authenticator/src/security.ts", import.meta.url), "utf8");
const totp = readFileSync(new URL("../../Authenticator/src/totp.ts", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../../Authenticator/package.json", import.meta.url), "utf8");
const backend = readFileSync(new URL("../../Backend/backend/identity_auth.py", import.meta.url), "utf8");
const login = readFileSync(new URL("../components/workspace-login-form.tsx", import.meta.url), "utf8");\nconst installPage = readFileSync(new URL("../app/office/authenticator/page.tsx", import.meta.url), "utf8");

describe("KRAVIA Authenticator boundary", () => {
  it("makes the dedicated authenticator mandatory for every Office role", () => {
    expect(backend).toContain('MFA_AUTHENTICATOR_APP = "KRAVIA Authenticator"');
    expect(backend).toContain('"mfa_required_for_all_roles": True');
    expect(backend).toContain('"mfa_policy": "AAL2_REQUIRED"');
    for (const role of ["OWNER", "DIRECTOR", "ADMIN", "MEMBER", "FINANCE", "CA", "CS", "LEGAL", "HR", "OPERATIONS", "AUDITOR", "PRODUCT_ADMIN"]) {
      expect(login).toContain(`"${role}"`);
    }
    expect(login).toContain("KRAVIA Authenticator is required for every Office role");
    expect(login).toContain('href="/office/authenticator"');
    expect(installPage).toContain("MANDATORY FOR EVERY OFFICE ROLE");
    expect(installPage).toContain("KRAVIA_AUTHENTICATOR_ANDROID_URL");
    expect(installPage).toContain("KRAVIA_AUTHENTICATOR_IOS_URL");
  });

  it("uses the standard KRAVIA TOTP profile rather than proprietary OTP crypto", () => {
    expect(backend).toContain('MFA_ISSUER = "KRAVIA Office"');
    expect(backend).toContain('MFA_ALGORITHM = "SHA1"');
    expect(backend).toContain("MFA_DIGITS = 6");
    expect(backend).toContain("MFA_PERIOD_SECONDS = 30");
    expect(totp).toContain("hmac(sha1");
    expect(totp).toContain("Math.floor(timestampMs / 1000 / period)");
  });

  it("keeps the enrollment secret on-device and blocks non-KRAVIA QR codes", () => {
    expect(storage).toContain("expo-secure-store");
    expect(storage).toContain("WHEN_PASSCODE_SET_THIS_DEVICE_ONLY");
    expect(provisioning).toContain('issuer !== KRAVIA_ISSUER');
    expect(provisioning).toContain("This QR code was not issued by KRAVIA Office");
    expect(app).toContain("usePreventScreenCapture");
    expect(app).toContain("enableAppSwitcherProtectionAsync");
    expect(app).toContain("unlockAuthenticator");
  });

  it("ships a native Android/iOS Expo app instead of a web OTP widget", () => {
    expect(packageJson).toContain('"expo": "57.0.22"');
    expect(packageJson).toContain('"react-native": "0.86.2"');
    expect(packageJson).toContain('"expo-camera"');
    expect(packageJson).toContain('"expo-local-authentication"');
    expect(packageJson).toContain('"expo-secure-store"');
    expect(app).toContain("CameraView");
    expect(app).toContain("generateTotp");
  });
});
