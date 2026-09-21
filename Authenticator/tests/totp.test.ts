import { describe, expect, it } from "vitest";
import { generateTotp, totpWindow } from "../src/totp";

const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("RFC 6238 TOTP", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("matches the SHA1 vector at %i", (seconds, expected) => {
    expect(generateTotp(RFC_SECRET, seconds * 1000, 8, 30)).toBe(expected);
  });

  it("generates a 6 digit KRAVIA code", () => {
    expect(generateTotp(RFC_SECRET, 59_000)).toMatch(/^\d{6}$/);
  });

  it("reports the current 30 second window", () => {
    expect(totpWindow(5_000, 30)).toEqual({ remaining: 25, progress: 25 / 30 });
  });
});
