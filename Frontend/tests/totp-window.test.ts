import { describe, expect, it } from "vitest";
import { OFFICE_TOTP_PERIOD_SECONDS, officeTotpWindow } from "../lib/office/totp-window";

describe("Office Authenticator-code window", () => {
  it("matches the server's 30-second TOTP cadence without handling a secret", () => {
    expect(OFFICE_TOTP_PERIOD_SECONDS).toBe(30);
    expect(officeTotpWindow(0)).toEqual({ index: 0, remaining: 30, progress: 1 });
    expect(officeTotpWindow(29_000)).toEqual({ index: 0, remaining: 1, progress: 1 / 30 });
    expect(officeTotpWindow(30_000)).toEqual({ index: 1, remaining: 30, progress: 1 });
  });
});
