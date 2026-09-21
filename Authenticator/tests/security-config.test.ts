import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appConfig = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8"));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const storage = readFileSync(new URL("../src/storage.ts", import.meta.url), "utf8");
const security = readFileSync(new URL("../src/security.ts", import.meta.url), "utf8");

describe("KRAVIA Authenticator security profile", () => {
  it("is offline-only in the Android production manifest", () => {
    expect(appConfig.expo.android.allowBackup).toBe(false);
    expect(appConfig.expo.android.blockedPermissions).toContain("android.permission.INTERNET");
    expect(appConfig.expo.android.blockedPermissions).toContain("android.permission.RECORD_AUDIO");
    expect(appConfig.expo.android.permissions).toEqual(["android.permission.CAMERA"]);
    expect(appConfig.expo.extra.networkMode).toBe("OFFLINE_ONLY");
  });

  it("does not expose OTP values through the clipboard", () => {
    expect(pkg.dependencies["expo-clipboard"]).toBeUndefined();
    expect(app).not.toContain("Clipboard.setString");
    expect(app).not.toContain("copyCode");
    expect(app).toContain("Clipboard export is disabled");
  });

  it("keeps the TOTP seed device-bound and destroys stale reinstall state", () => {
    expect(storage).toContain("WHEN_PASSCODE_SET_THIS_DEVICE_ONLY");
    expect(storage).toContain("INSTALL_LOCAL_KEY");
    expect(storage).toContain("INSTALL_SECURE_KEY");
    expect(storage).toContain("AsyncStorage.getItem");
    expect(storage).toContain("Crypto.randomUUID()");
    expect(storage).toContain("SecureStore.deleteItemAsync(STORE_KEY");
  });

  it("requires strong local biometrics and wipes in-memory enrollment on lock", () => {
    expect(security).toContain("SecurityLevel.BIOMETRIC_STRONG");
    expect(security).toContain('biometricsSecurityLevel: "strong"');
    expect(app).toContain('if (state !== "active")');
    expect(app).toContain("setAccount(null)");
    expect(app).toContain("setManualSecret(\"\")");
    expect(app).toContain("secureTextEntry");
  });

  it("blocks screen capture and contains no application network client", () => {
    expect(app).toContain('usePreventScreenCapture("kravia-authenticator")');
    expect(app).not.toContain("fetch(");
    expect(app).not.toContain("axios");
  });
});
