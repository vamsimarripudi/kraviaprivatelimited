import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

describe("KRAVIA Office auth cache boundary", () => {
  it("forces every Office auth route response to be non-cacheable", () => {
    expect(nextConfig).toContain('source: "/api/office-auth/:path*"');
    expect(nextConfig).toContain('{ key: "Cache-Control", value: "no-store, max-age=0" }');
    expect(nextConfig).toContain('{ key: "Pragma", value: "no-cache" }');
    expect(nextConfig).toContain('{ key: "Expires", value: "0" }');
  });
});
