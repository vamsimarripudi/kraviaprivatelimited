import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as { ignoreCommand: string };
const login = readFileSync(new URL("../components/workspace-login-form.tsx", import.meta.url), "utf8");
const release = readFileSync(new URL("../app/api/office-release/route.ts", import.meta.url), "utf8");

describe("KRAVIA Office auth cache boundary", () => {
  it("permits a validated isolated build directory without changing production output defaults", () => {
    expect(nextConfig).toContain("KRAVIA_NEXT_DIST_DIR");
    expect(nextConfig).toContain("isolated .next-* directory name");
    expect(nextConfig).toContain("distDir: requestedDistDir");
  });

  it("forces every Office auth route response to be non-cacheable", () => {
    expect(nextConfig).toContain('source: "/api/office-auth/:path*"');
    expect(nextConfig).toContain('{ key: "Cache-Control", value: "no-store, max-age=0" }');
    expect(nextConfig).toContain('{ key: "Pragma", value: "no-cache" }');
    expect(nextConfig).toContain('{ key: "Expires", value: "0" }');
  });

  it("prevents stale Office login HTML and exposes a truthful release fingerprint", () => {
    expect(nextConfig).toContain('source: "/office/login"');
    expect(nextConfig).toContain("private, no-store, max-age=0, must-revalidate");
    expect(nextConfig).toContain("X-KRAVIA-Office-Login-Release");
    expect(login).toContain("corporate email OTP if enabled for your account");
    expect(login).toContain('data-office-login-release="2026-11-12-email-otp-choice"');
    expect(release).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(release).toContain('"Cache-Control": "no-store, max-age=0, must-revalidate"');
    expect(release).not.toContain("process.env.BREVO_API_KEY");
  });

  it("forces a real Vercel build for an explicit frontend deploy rather than false-green ignore", () => {
    expect(vercel.ignoreCommand).toContain("^deploy(frontend):");
    expect(vercel.ignoreCommand).toContain("exit 1");
    expect(vercel.ignoreCommand).toContain("git diff --quiet HEAD^ HEAD ./");
    expect(vercel.ignoreCommand).not.toBe("git diff --quiet HEAD^ HEAD ./");
  });
});
