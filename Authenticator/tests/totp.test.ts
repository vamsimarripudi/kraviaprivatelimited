import { describe, expect, it } from "vitest";

import { currentTotp } from "../src/totp";

describe("currentTotp", () => {
  const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  it("matches the RFC 6238 SHA-1 vector while exposing a six-digit local code", () => {
    expect(currentTotp(rfcSecret, 59_000)).toMatchObject({
      code: "287082",
      remaining: 1,
      period: 30,
    });
    expect(currentTotp(rfcSecret, 60_000)).toMatchObject({
      code: "359152",
      remaining: 30,
      period: 30,
    });
  });

  it("rejects malformed locally stored secrets instead of generating a code", () => {
    expect(() => currentTotp("not-a-valid-secret", 60_000)).toThrow(
      "Authenticator secret is invalid",
    );
  });
});
