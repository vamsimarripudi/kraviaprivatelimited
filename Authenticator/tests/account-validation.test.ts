import { describe, expect, it } from "vitest";
import { validateStoredAccount } from "../src/account-validation";

const valid = {
  version: 1,
  issuer: "KRAVIA Office",
  account: "user@kraviaprivatelimited.com",
  secret: "JBSWY3DPEHPK3PXP",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  enrolledAt: "2026-09-21T04:00:00.000Z",
};

describe("KRAVIA persisted authenticator state", () => {
  it("accepts and normalizes a valid account", () => {
    expect(validateStoredAccount({ ...valid, account: "User@KraviaPrivateLimited.com", secret: "JBSW Y3DP EHPK 3PXP" })).toEqual(valid);
  });

  it("rejects non-KRAVIA accounts", () => {
    expect(validateStoredAccount({ ...valid, account: "user@example.com" })).toBeNull();
  });

  it("rejects malformed or weak secrets", () => {
    expect(validateStoredAccount({ ...valid, secret: "ABC" })).toBeNull();
    expect(validateStoredAccount({ ...valid, secret: "JBSWY3DPEHPK3PX!" })).toBeNull();
  });

  it("rejects altered TOTP parameters", () => {
    expect(validateStoredAccount({ ...valid, period: 60 })).toBeNull();
    expect(validateStoredAccount({ ...valid, digits: 8 })).toBeNull();
    expect(validateStoredAccount({ ...valid, algorithm: "SHA256" })).toBeNull();
  });

  it("rejects invalid enrollment timestamps", () => {
    expect(validateStoredAccount({ ...valid, enrolledAt: "not-a-date" })).toBeNull();
  });
});
