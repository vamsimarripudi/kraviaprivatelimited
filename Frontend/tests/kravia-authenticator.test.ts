import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../../Authenticator/App.tsx", import.meta.url), "utf8");
const activation = readFileSync(new URL("../../Authenticator/src/activation.ts", import.meta.url), "utf8");
const storage = readFileSync(new URL("../../Authenticator/src/storage.ts", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../../Authenticator/package.json", import.meta.url), "utf8");
const appJson = readFileSync(new URL("../../Authenticator/app.json", import.meta.url), "utf8");
const appConfig = JSON.parse(appJson) as { expo: { android: { permissions: string[]; blockedPermissions: string[] } } };
const backend = readFileSync(new URL("../../Backend/backend/identity_auth.py", import.meta.url), "utf8");
const login = readFileSync(new URL("../components/workspace-login-form.tsx", import.meta.url), "utf8");
const installPage = readFileSync(new URL("../app/office/authenticator/page.tsx", import.meta.url), "utf8");

describe("KRAVIA Authenticator verified-device boundary", () => {
  it("keeps the Office AAL2 policy mandatory for every role", () => {
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

  it("uses credential-email verification before a trusted-device session", () => {
    expect(backend).toContain('/email-otp/challenges');
    expect(backend).toContain('"authenticator_mobile"');
    expect(backend).toContain("EMAIL_OTP_TTL_SECONDS");
    expect(backend).toContain("EMAIL_OTP_MOBILE_REFRESH_TTL_SECONDS");
    expect(activation).toContain("requestEmailOtp");
    expect(activation).toContain("resendEmailOtp");
    expect(activation).toContain("verifyEmailOtp");
    expect(activation).toContain("checkDeviceApproval");
    expect(activation).toContain("completeDeviceApproval");
    expect(activation).toContain('protocol !== "https:"');
    expect(storage).toContain("SESSION_STORE_KEY");
    expect(storage).toContain("refreshToken");
    expect(storage).toContain("PENDING_DEVICE_STORE_KEY");
    expect(storage).toContain("TRUSTED_DEVICE_STORE_KEY");
    expect(app).toContain("security review");
    expect(app).toMatch(/continues\s+automatically/);
    expect(app).not.toContain("Check decision");
    expect(app).toContain("This phone is trusted and its local sign-in code is ready.");
    expect(app).toContain("currentTotp(");
    expect(storage).toContain("FACTOR_STORE_KEY");
    expect(app).not.toContain("generateTotp");
    expect(login).toContain("officeTotpWindow");
    expect(login).toContain('phase === "success"');
    expect(login).toContain("Authenticator code accepted");
    expect(login).toContain("codeExpired");
  });

  it("keeps a new Office browser pending until its own account holder decides it", () => {
    expect(backend).toContain("PENDING_DEVICE_APPROVAL");
    expect(backend).toContain("DEVICE_APPROVAL_REQUIRED");
    expect(backend).toContain("DEVICE_APPROVAL_COMPLETED");
    expect(backend).toContain("owner_action_token_hash");
    expect(backend).toContain("device_token_hash");
    expect(login).toContain('phase === "device-approval"');
    expect(login).toContain("original browser");
    expect(login).toContain("device-approval/status");
    expect(login).toContain("deviceApprovalCompletionInFlight");
    expect(login).toContain("deviceApprovalRetryRequired");
    expect(login).toContain("Retry secure sign-in");
    expect(login).toContain('approval.status === "APPROVED" || approval.status === "TRUSTED"');
  });

  it("limits QR and camera use to trusted-device browser approval, never enrollment", () => {
    expect(app).toContain("Enter your registered corporate email and password.");
    expect(app).toContain("Enter your code");
    expect(app).toContain("usePreventScreenCapture");
    expect(app).toContain("enableAppSwitcherProtectionAsync");
    expect(app).toContain("CameraView");
    expect(app).toContain('barcodeTypes: ["qr"]');
    expect(app).toContain("Accept sign-in");
    expect(app).toContain("Reject sign-in");
    expect(app).toContain("No QR enrollment or setup key is supported.");
    expect(app).not.toContain("Enter setup key");
    expect(app).not.toContain("manual account");
    expect(app).not.toContain("Clipboard.setString");
    expect(packageJson).toContain('"expo-camera"');
    expect(packageJson).not.toContain('"expo-clipboard"');
  });

  it("ships a native Android/iOS Expo app with scoped camera and network permissions", () => {
    expect(packageJson).toContain('"expo": "~57.0.27"');
    expect(packageJson).toContain('"expo-secure-store"');
    expect(appJson).toContain('"android.permission.INTERNET"');
    expect(appConfig.expo.android.permissions).toContain("android.permission.CAMERA");
    expect(appConfig.expo.android.permissions).not.toContain("android.permission.RECORD_AUDIO");
    expect(appConfig.expo.android.blockedPermissions).toContain("android.permission.RECORD_AUDIO");
    expect(appJson).toContain('"EMAIL_OTP_TRUSTED_DEVICE_QR_SIGN_IN"');
    expect(appJson).toContain('"allowBackup": false');
    expect(app).toContain("TimerCircle");
  });
});
