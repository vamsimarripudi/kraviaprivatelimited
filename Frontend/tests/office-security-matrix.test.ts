import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("KRAVIA Office repository-wide security matrix", () => {
  it("requires same-origin protection on every browser-facing Office mutation route", () => {
    const apiRoot = resolve(import.meta.dirname, "../app/api");
    const routes = filesUnder(apiRoot)
      .filter((path) => path.endsWith("route.ts"))
      .filter((path) => /[/\\]office(?:-|runtime)/.test(path));

    const violations: string[] = [];
    for (const path of routes) {
      const source = readFileSync(path, "utf8");
      const mutates = /export\s+(?:async\s+function|const)\s+(POST|PUT|PATCH|DELETE)\b/.test(source);
      if (!mutates) continue;

      const rel = relative(apiRoot, path).replaceAll("\\", "/");
      const externallySignedWebhook = rel.includes("webhook") && /signature|hmac|verify/i.test(source);
      const sameOrigin = source.includes("officeMutationIsSameOrigin");
      if (!sameOrigin && !externallySignedWebhook) violations.push(rel);
    }

    expect(violations).toEqual([]);
  });

  it("requires an explicit identity or permission boundary in service-authority mutation modules", () => {
    const officeRoot = resolve(import.meta.dirname, "../lib/office");
    const files = filesUnder(officeRoot).filter((path) => path.endsWith("-server.ts"));
    const violations: string[] = [];

    for (const path of files) {
      const source = readFileSync(path, "utf8");
      const mutates = /\.(?:insert|update|delete|upsert|rpc)\s*\(/.test(source);
      const serviceAuthority = /createOfficeServiceClient|requireOfficeAdminEnvironment|createClient\(/.test(source);
      if (!mutates || !serviceAuthority) continue;

      const hasBoundary = [
        "requireOfficePermission",
        "resolveOfficePermission",
        "requireOfficeActor",
        "canAdministerAccess",
        "officeIdentityIsProvisioned",
        "getOfficeSessionContext",
      ].some((marker) => source.includes(marker));

      if (!hasBoundary) violations.push(relative(officeRoot, path).replaceAll("\\", "/"));
    }

    expect(violations).toEqual([]);
  });

  it("keeps direct Supabase Auth administration out of active Office server modules", () => {
    const officeRoot = resolve(import.meta.dirname, "../lib/office");
    const violations = filesUnder(officeRoot)
      .filter((path) => path.endsWith(".ts"))
      .filter((path) => /admin\.auth\.admin|\.auth\.signIn|\.auth\.mfa|resetPasswordForEmail/.test(readFileSync(path, "utf8")))
      .map((path) => relative(officeRoot, path).replaceAll("\\", "/"));

    expect(violations).toEqual([]);
  });
});
