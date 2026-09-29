import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../../Authenticator/App.tsx", import.meta.url), "utf8");
const activation = readFileSync(new URL("../../Authenticator/src/activation.ts", import.meta.url), "utf8");
const storage = readFileSync(new URL("../../Authenticator/src/storage.ts", import.meta.url), "utf8");
const security = readFileSync(new URL("../../Authenticator/src/security.ts", import.meta.url), "utf8");
const totp = readFileSync(new URL("../../Authenticator/src/totp.ts", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../../Authenticator/package.json", import.meta.url), "utf8");
const appJson = readFileSync(new URL("../../Authenticator/app.json", import.meta.url), "utf8");
const accountValidation = readFileSync(new URL("../../Authenticator/src/account-validation.ts", import.meta.url), "utf8");
const backend = readFileSync(new URL("../../Backend/backend/identity_auth.py", import.meta.url), "utf8");
const login = readFileSync(new URL("../components/workspace-login-form.tsx", import.meta.url), "utf8");
const installPage = readFileSync(new URL("../app/office/authenticator/page.tsx", import.meta.url), "utf8");

describe("Authenticator activation boundary", () => {
  it("keeps AAL2 mandatory for every Office role", () => {
    expect(backend).toContain('MFA_AUTHENTICATOR_APP = "Authenticator"');
    expect(backend).toContain('"mfa_required_for_all_roles": True');
    expect(backend).toContain('"mfa_policy": "AAL2_REQUIRED"');
    for (const role of ["OWNER", "DIRECTOR", "ADMIN", "MEMBER", "FINANCE", "CA", "CS", "LEGAL", "HR", "OPERATIONS", "AUDITOR", "PRODUCT_ADMIN"]) {
      expect(login).toContain(`"${role}"`);
    }
    expect(login).toContain('href="/office/authenticator"');
    expect(installPage).toContain("MANDATORY FOR EVERY OFFICE ROLE");
    expect(installPage).toContain("KRAVIA_AUTHENTICATOR_ANDROID_URL");
    expect(installPage).toContain("KRAVIA_AUTHENTICATOR_IOS_URL");
  });

  it("releases a new seed only through a short-lived, approved phone claim", () => {
    expect(backend).toContain("/authenticator/activation-requests");
    expect(backend).toContain("AUTHENTICATOR_ACTIVATION_APPROVED");
    expect(backend).toContain("require_aal2=True");
    expect(backend).toContain("Only Office owners or administrators can approve");
    expect(backend).not.toContain('@router.post("/mfa/enroll")');
    expect(activation).toContain("requestAuthenticatorActivation");
    expect(activation).toContain("claimAuthenticatorActivation");
    expect(activation).toContain('protocol !== "https:"');
    expect(storage).toContain("PENDING_ACTIVATION_STORE_KEY");
    expect(storage).toContain("clearPendingActivation");
  });

  it("uses the standard KRAVIA TOTP profile rather than proprietary OTP crypto", () => {
    expect(backend).toContain('MFA_ISSUER = "KRAVIA Office"');
    expect(backend).toContain('MFA_ALGORITHM = "SHA1"');
    expect(backend).toContain("MFA_DIGITS = 6");
    expect(backend).toContain("MFA_PERIOD_SECONDS = 30");
    expect(totp).toContain("hmac(sha1");
    expect(totp).toContain("Math.floor(timestampMs / 1000 / period)");
    expect(backend).toContain("mfa_last_accepted_counter");
    expect(backend).toContain("MFA_REPLAY_BLOCKED");
  });

  it("keeps the vault on-device with no QR, setup key, or clipboard export", () => {
    expect(storage).toContain("expo-secure-store");
    expect(storage).toContain("WHEN_PASSCODE_SET_THIS_DEVICE_ONLY");
    expect(accountValidation).toContain("kraviaprivatelimited");
    expect(accountValidation).toContain("normalizedSecret.length < 16");
    expect(app).toContain("usePreventScreenCapture");
    expect(app).toContain("enableAppSwitcherProtectionAsync");
    expect(app).toContain("unlockAuthenticator");
    expect(app).toContain("Sign in to activate");
    expect(app).not.toContain("CameraView");
    expect(app).not.toContain("setup key");
    expect(app).not.toContain("QR code");
    expect(app).not.toContain("Clipboard.setString");
    expect(app).toContain("Clipboard export is disabled");
    expect(security).toContain("SecurityLevel.BIOMETRIC_STRONG");
  });

  it("ships a native Android/iOS Expo app that permits only activation HTTPS", () => {
    expect(packageJson).toContain('"expo": "~57.0.24"');
    expect(packageJson).not.toContain('"expo-camera"');
    expect(packageJson).toContain('"expo-local-authentication"');
    expect(packageJson).toContain('"expo-secure-store"');
    expect(appJson).toContain('"android.permission.INTERNET"');
    expect(appJson).not.toContain('"android.permission.CAMERA"');
    expect(appJson).toContain('"CREDENTIAL_ACTIVATION_OFFLINE_TOTP"');
    expect(appJson).toContain('"resizeMode": "contain"');
    expect(app).toContain("generateTotp");
  });
});
