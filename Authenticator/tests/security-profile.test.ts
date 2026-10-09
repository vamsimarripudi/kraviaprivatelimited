import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8"));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const brand = JSON.parse(readFileSync(new URL("../assets-source/brand-assets.json", import.meta.url), "utf8"));
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("../src/storage.ts", import.meta.url), "utf8");
const securitySource = readFileSync(new URL("../src/security.ts", import.meta.url), "utf8");

function hashAsset(name: string) {
  const value = brand[name];
  return createHash("sha256").update(Buffer.from(value.chunks.join(""), "base64")).digest("hex");
}

describe("KRAVIA Authenticator native security profile", () => {
  it("ships only for native iOS and Android with KRAVIA-controlled identifiers", () => {
    expect(app.expo.platforms).toEqual(["ios", "android"]);
    expect(app.expo.android.package).toBe("com.kraviaprivatelimited.authenticator");
    expect(app.expo.ios.bundleIdentifier).toBe("com.kraviaprivatelimited.authenticator");
    expect(app.expo.android.allowBackup).toBe(false);
    expect(app.expo.icon).toBe("./assets/brand/icon.png");
  });

  it("keeps approved generated artwork byte-for-byte unchanged", () => {
    expect(hashAsset("icon")).toBe("4c46b22a325a1a199292c3b2a128291ee6ba2161799143e3decea39a1c1dd44d");
    expect(hashAsset("splash")).toBe("4ed3432c1470c3b2f35bdf4ea2583a4bd3f23ef4176ea0ff084c7a3199d6db4f");
    expect(hashAsset("loading")).toBe("8fb4df780b665c6d0b394510ab5b9345d2799051553d75527dee8fafc724920f");
    expect(hashAsset("settings_reference")).toBe("8170fe77d82c238e57901724408021d7533bddaabb79aa2a9d2754a9ebbd6c1a");
    expect(appSource).toContain('require("./assets/brand/splash.jpg")');
    expect(appSource).toContain('require("./assets/brand/loading.jpg")');
  });

  it("has the secure native permissions and disables OTA executable updates", () => {
    expect(app.expo.updates.enabled).toBe(false);
    expect(app.expo.android.permissions).toContain("android.permission.INTERNET");
    expect(app.expo.android.permissions).toContain("android.permission.USE_BIOMETRIC");
    expect(app.expo.android.permissions).toContain("android.permission.CAMERA");
    expect(app.expo.android.permissions).not.toContain("android.permission.RECORD_AUDIO");
    expect(app.expo.android.blockedPermissions).toContain("android.permission.RECORD_AUDIO");
    expect(app.expo.extra.networkModel).toBe("EMAIL_OTP_TRUSTED_DEVICE_QR_SIGN_IN");
    expect(app.expo.extra.otpClipboard).toBe("DISABLED");
  });

  it("pins the installation graph needed for native local protection", () => {
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.packages[""].dependencies).toEqual(pkg.dependencies);
    expect(lock.packages[""].devDependencies).toEqual(pkg.devDependencies);
    expect(pkg.dependencies["@noble/hashes"]).toBe("2.4.0");
    expect(pkg.dependencies["expo-file-system"]).toBe("~57.0.7");
    expect(pkg.dependencies["expo-local-authentication"]).toBe("~57.0.3");
    expect(pkg.dependencies["expo-camera"]).toBe("~57.0.6");
    expect(pkg.dependencies["expo-clipboard"]).toBeUndefined();
  });

  it("requires strong local biometrics, keeps notification shade transitions from clearing a code, and locks on background", () => {
    expect(securitySource).toContain("SecurityLevel.BIOMETRIC_STRONG");
    expect(securitySource).toContain("supportedAuthenticationTypesAsync");
    expect(securitySource).toContain("AuthenticationType.FACIAL_RECOGNITION");
    expect(securitySource).toContain("AuthenticationType.FINGERPRINT");
    expect(securitySource).toContain('Platform.OS === "android"');
    expect(securitySource).toContain('platform === "ios"');
    expect(securitySource).toContain('biometricsSecurityLevel: "strong"');
    expect(securitySource).toContain('disableDeviceFallback: true');
    expect(securitySource).toContain('fallbackLabel: ""');
    expect(securitySource).toContain("Expo Go cannot perform Face ID");
    expect(securitySource).toContain("authentication_failed");
    expect(securitySource).not.toContain("Device authentication was not completed.");
    expect(securitySource).not.toContain('Use device passcode');
    expect(appSource).toContain('state === "background"');
    expect(appSource).toContain('if (state === "background")');
    expect(appSource).toContain('["home", "scan", "qr-review", "settings"].includes(screen)');
    expect(appSource).toContain("usePreventScreenCapture(\"authenticator\")");
    expect(appSource).toContain("enableAppSwitcherProtectionAsync");
    expect(appSource).toContain("Security centre");
    expect(appSource).toContain("BIOMETRIC UNLOCK");
    expect(appSource).toContain("AppTopBar");
    expect(appSource).toContain("BiometricControl");
    expect(appSource).toContain("Operated by KRAVIA PRIVATE LIMITED");
    expect(appSource).toContain("Authenticator v{APP_VERSION}");
    expect(appSource).toContain("SecureLoadingScreen");
    expect(appSource).toContain("UnavailableScreen");
    expect(appSource).toContain('current.status === "APPROVED" || current.status === "TRUSTED"');
    expect(appSource).toContain("Keep Authenticator open; it will retry automatically.");
    expect(appSource).toContain("setFactor(enrolledFactor);\n          setPendingDevice(null);\n          setScreen(\"home\");");
    expect(appSource).not.toContain('label="Return to welcome"');
    expect(appSource).toContain("setInterval(() => setNow(Date.now()), 1_000)");
  });

  it("keeps the pending approval, trusted-device binding, and session in secure storage", () => {
    expect(storageSource).toContain("PENDING_DEVICE_STORE_KEY");
    expect(storageSource).toContain("TRUSTED_DEVICE_STORE_KEY");
    expect(storageSource).toContain("SESSION_STORE_KEY");
    expect(storageSource).toContain("FACTOR_STORE_KEY");
    expect(storageSource).toContain("WHEN_PASSCODE_SET_THIS_DEVICE_ONLY");
    expect(storageSource).toContain("INSTALL_SECURE_KEY");
    expect(storageSource).toContain("RETIRED_STORE_KEYS");
    expect(storageSource).toContain("saveTrustedDeviceBinding");
    expect(storageSource).toContain("saveAuthenticatorFactor");
    expect(appSource).toContain("currentTotp(");
    expect(appSource).toContain("One trusted phone");
  });

  it("limits camera use to short-lived browser sign-in approval, not factor enrollment", () => {
    expect(appSource).toContain("security review");
    expect(appSource).toContain("CameraView");
    expect(appSource).toContain('barcodeTypes: ["qr"]');
    expect(appSource).toContain("parseQrSigninPayload");
    expect(appSource).toContain("Accept sign-in");
    expect(appSource).toContain("Reject sign-in");
    expect(appSource).toContain("Approve browser sign-in");
    expect(appSource).toContain("No QR enrollment or setup key is supported.");
    expect(appSource).not.toContain("Enter code manually");
    expect(appSource).not.toContain("Enter setup key");
    expect(appSource).not.toContain("Clipboard.setString");
    expect(appSource).not.toContain("Clipboard.getString");
  });
});
