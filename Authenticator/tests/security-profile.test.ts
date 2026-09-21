import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8"));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("../src/storage.ts", import.meta.url), "utf8");
const securitySource = readFileSync(new URL("../src/security.ts", import.meta.url), "utf8");

describe("KRAVIA Authenticator native security profile", () => {
  it("ships only for native iOS and Android with KRAVIA-controlled identifiers", () => {
    expect(app.expo.platforms).toEqual(["ios", "android"]);
    expect(app.expo.android.package).toBe("com.kraviaprivatelimited.authenticator");
    expect(app.expo.ios.bundleIdentifier).toBe("com.kraviaprivatelimited.authenticator");
    expect(app.expo.android.allowBackup).toBe(false);
    expect(app.expo.icon).toBe("./assets/icon.png");
    expect(app.expo.android.adaptiveIcon.foregroundImage).toBe("./assets/icon.png");
  });

  it("keeps the v1 OTP runtime offline and disables OTA executable updates", () => {
    expect(app.expo.updates.enabled).toBe(false);
    expect(app.expo.android.blockedPermissions).toContain("android.permission.INTERNET");
    expect(app.expo.android.blockedPermissions).toContain("android.permission.RECORD_AUDIO");
    expect(app.expo.extra.networkModel).toBe("OFFLINE_TOTP_ONLY");
    expect(app.expo.extra.otpClipboard).toBe("DISABLED");
  });

  it("pins the install graph with a committed npm lockfile", () => {
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.packages[""].dependencies).toEqual(pkg.dependencies);
    expect(lock.packages[""].devDependencies).toEqual(pkg.devDependencies);
    expect(pkg.dependencies["expo-clipboard"]).toBeUndefined();
    expect(pkg.dependencies["expo-file-system"]).toBe("~57.0.7");
    expect(lock.packages["node_modules/expo-clipboard"]).toBeUndefined();
  });

  it("requires strong local biometrics and clears sensitive state on lock", () => {
    expect(securitySource).toContain("SecurityLevel.BIOMETRIC_STRONG");
    expect(securitySource).toContain('biometricsSecurityLevel: "strong"');
    expect(appSource).toContain('if (state !== "active")');
    expect(appSource).toContain("setAccount(null)");
    expect(appSource).toContain('setManualSecret("")');
    expect(appSource).toContain("secureTextEntry");
  });

  it("does not export OTPs to the clipboard", () => {
    expect(appSource).not.toContain("Clipboard.setString");
    expect(appSource).not.toContain("Clipboard.getString");
    expect(appSource).not.toContain("copyCode");
    expect(appSource).toContain("Clipboard export is disabled");
  });

  it("invalidates a surviving keychain seed after app reinstall", () => {
    expect(storageSource).toContain('from "expo-file-system/legacy"');
    expect(storageSource).toContain("INSTALL_SECURE_KEY");
    expect(storageSource).toContain("INSTALL_FILE_NAME");
    expect(storageSource).toContain("localMarker === secureMarker");
    expect(storageSource).toContain("SecureStore.deleteItemAsync(STORE_KEY");
    expect(storageSource).toContain("WHEN_PASSCODE_SET_THIS_DEVICE_ONLY");
  });
});
