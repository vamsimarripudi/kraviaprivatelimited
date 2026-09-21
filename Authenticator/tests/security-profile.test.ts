import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8"));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));

describe("KRAVIA Authenticator native security profile", () => {
  it("ships only for native iOS and Android with KRAVIA-controlled identifiers", () => {
    expect(app.expo.platforms).toEqual(["ios", "android"]);
    expect(app.expo.android.package).toBe("com.kraviaprivatelimited.authenticator");
    expect(app.expo.ios.bundleIdentifier).toBe("com.kraviaprivatelimited.authenticator");
    expect(app.expo.android.allowBackup).toBe(false);
  });

  it("keeps the v1 OTP runtime offline and disables OTA executable updates", () => {
    expect(app.expo.updates.enabled).toBe(false);
    expect(app.expo.android.blockedPermissions).toContain("android.permission.INTERNET");
    expect(app.expo.android.blockedPermissions).toContain("android.permission.RECORD_AUDIO");
    expect(app.expo.extra.networkModel).toBe("OFFLINE_TOTP_ONLY");
  });

  it("pins the install graph with a committed npm lockfile", () => {
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.packages[""].dependencies).toEqual(pkg.dependencies);
    expect(lock.packages[""].devDependencies).toEqual(pkg.devDependencies);
  });
});
