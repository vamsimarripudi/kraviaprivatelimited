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
  const bytes = Buffer.from(value.chunks.join(""), "base64");
  return createHash("sha256").update(bytes).digest("hex");
}

describe("KRAVIA Authenticator native security profile", () => {
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

  it("uses the Expo SDK 57 splash package and generated artwork", () => {
    expect(pkg.dependencies["expo"]).toBe("~57.0.24");
    expect(pkg.dependencies["expo-splash-screen"]).toBe("~57.0.9");
    expect(lock.packages[""].dependencies["expo-splash-screen"]).toBe("~57.0.9");
    expect(lock.packages["node_modules/expo-splash-screen"].version).toBe("57.0.9");
    const splashPlugin = app.expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen");
    expect(splashPlugin?.[1]?.image).toBe("./assets/brand/splash.jpg");
    expect(splashPlugin?.[1]?.resizeMode).toBe("cover");
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

  it("keeps security settings fail-closed and does not export OTPs to clipboard", () => {
    expect(appSource).not.toContain("Clipboard.setString");
    expect(appSource).not.toContain("Clipboard.getString");
    expect(appSource).not.toContain("copyCode");
    expect(appSource).toContain("Clipboard export is disabled");
    expect(appSource).toContain('title="Biometric Lock"');
    expect(appSource).toContain('title="Lock on Background"');
    expect(appSource).toContain('title="Clipboard Export"');
    expect(appSource).toContain('value={false}');
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
