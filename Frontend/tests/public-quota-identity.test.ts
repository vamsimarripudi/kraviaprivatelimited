import { afterEach, describe, expect, it, vi } from "vitest";
import { publicQuotaIdentity } from "../lib/corporate/public-quota";

function request(headers: Record<string, string>) {
  return new Request("https://www.kraviaprivatelimited.com/api/enquiries", { headers });
}

afterEach(() => vi.unstubAllEnvs());

describe("public quota request identity", () => {
  it("does not let local callers vary quota identity with forwarding headers", () => {
    vi.stubEnv("VERCEL_ENV", "");
    expect(publicQuotaIdentity(request({ "x-forwarded-for": "203.0.113.10" }))).toBe("unattributed-local");
    expect(publicQuotaIdentity(request({ "x-real-ip": "198.51.100.9" }))).toBe("unattributed-local");
  });

  it("accepts only a single Vercel-provided IP value in a Vercel runtime", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(publicQuotaIdentity(request({ "x-vercel-forwarded-for": "203.0.113.10", "x-forwarded-for": "198.51.100.9" }))).toBe("vercel-ip:203.0.113.10");
    expect(publicQuotaIdentity(request({ "x-forwarded-for": "203.0.113.10" }))).toBeNull();
    expect(publicQuotaIdentity(request({ "x-vercel-forwarded-for": "203.0.113.10, 198.51.100.9" }))).toBeNull();
    expect(publicQuotaIdentity(request({ "x-vercel-forwarded-for": "not-an-ip" }))).toBeNull();
  });
});
