import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8"));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const brand = JSON.parse(readFileSync(new URL("../assets-source/brand-assets.json", import.meta.url), "utf8"));
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("../src/storage.ts", import.meta.url), "utf8");

function hashAsset(name: string) {
  const value = brand[name];
  const bytes = Buffer.from(value.chunks.join(""), "base64");
  return createHash("sha256").update(bytes).digest("hex");
}

describe("KRAVIA email verification native security profile", () => {
  it("ships only for native iOS and Android with KRAVIA-controlled identifiers", () => {
    expect(app.expo.platforms).toEqual(["ios", "android"]);
    expect(app.expo.android.package).toBe("com.kraviaprivatelimited.authenticator");
    expect(app.expo.ios.bundleIdentifier).toBe("com.kraviaprivatelimited.authenticator");
    expect(app.expo.android.allowBackup).toBe(false);
    expect(app.expo.icon).toBe("./assets/brand/icon.png");
    expect(app.expo.android.adaptiveIcon.foregroundImage).toBe("./assets/brand/icon.png");
  });

  it("locks the approved generated visual assets by exact SHA-256", () => {
    expect(hashAsset("icon")).toBe("4c46b22a325a1a199292c3b2a128291ee6ba2161799143e3decea39a1c1dd44d");
    expect(hashAsset("splash")).toBe("4ed3432c1470c3b2f35bdf4ea2583a4bd3f23ef4176ea0ff084c7a3199d6db4f");
    expect(hashAsset("loading")).toBe("8fb4df780b665c6d0b394510ab5b9345d2799051553d75527dee8fafc724920f");
    expect(hashAsset("settings_reference")).toBe("8170fe77d82c238e57901724408021d7533bddaabb79aa2a9d2754a9ebbd6c1a");
    expect(appSource).toContain('require("./assets/brand/splash.jpg")');
    expect(appSource).toContain('require("./assets/brand/loading.jpg")');
    expect(appSource).toContain('require("./assets/brand/icon.png")');
  });

  it("uses the Expo SDK 57 splash package and camera-safe generated artwork", () => {
    expect(pkg.dependencies["expo"]).toBe("~57.0.26");
    expect(pkg.dependencies["expo-splash-screen"]).toBe("~57.0.9");
    expect(lock.packages[""].dependencies["expo-splash-screen"]).toBe("~57.0.9");
    expect(lock.packages["node_modules/expo-splash-screen"].version).toBe("57.0.9");
    const splashPlugin = app.expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen");
    expect(splashPlugin?.[1]?.image).toBe("./assets/brand/splash.jpg");
    expect(splashPlugin?.[1]?.resizeMode).toBe("contain");
  });

  it("permits only the email-verification boundary and disables OTA executable updates", () => {
    expect(app.expo.updates.enabled).toBe(false);
    expect(app.expo.android.blockedPermissions).toContain("android.permission.RECORD_AUDIO");
    expect(app.expo.android.permissions).toContain("android.permission.INTERNET");
    expect(app.expo.android.permissions).not.toContain("android.permission.CAMERA");
    expect(app.expo.extra.networkModel).toBe("CREDENTIAL_EMAIL_OTP_SESSION");
    expect(app.expo.extra.otpClipboard).toBe("DISABLED");
  });

  it("pins the install graph with a committed npm lockfile", () => {
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.packages[""].dependencies).toEqual(pkg.dependencies);
    expect(lock.packages[""].devDependencies).toEqual(pkg.devDependencies);
    expect(pkg.dependencies["expo-clipboard"]).toBeUndefined();
    expect(pkg.dependencies["expo-camera"]).toBeUndefined();
    expect(pkg.dependencies["expo-local-authentication"]).toBeUndefined();
    expect(pkg.dependencies["expo-file-system"]).toBeUndefined();
    expect(pkg.dependencies["@noble/hashes"]).toBeUndefined();
    expect(lock.packages["node_modules/expo-camera"]).toBeUndefined();
  });

  it("clears credentials from memory and protects verification surfaces", () => {
    expect(appSource).toContain('usePreventScreenCapture("email-otp")');
    expect(appSource).toContain("enableAppSwitcherProtectionAsync");
    expect(appSource).toContain('state !== "active"');
    expect(appSource).toContain('setPassword("")');
    expect(appSource).toContain('setOtp("")');
    expect(appSource).toContain("secureTextEntry");
  });

  it("does not export email codes to the clipboard", () => {
    expect(appSource).not.toContain("Clipboard.setString");
    expect(appSource).not.toContain("Clipboard.getString");
    expect(appSource).toContain("KRAVIA will never ask you to share this code");
  });

  it("retires the previous local TOTP vault and stores only valid sessions", () => {
    expect(storageSource).toContain("LEGACY_ACCOUNT_STORE_KEY");
    expect(storageSource).toContain("LEGACY_ACTIVATION_STORE_KEY");
    expect(storageSource).toContain("retireLegacyTotpVault");
    expect(storageSource).toContain('keychainService: "kravia-authenticator-v1"');
    expect(storageSource).toContain("SESSION_STORE_KEY");
    expect(storageSource).toContain("WHEN_PASSCODE_SET_THIS_DEVICE_ONLY");
  });
});
