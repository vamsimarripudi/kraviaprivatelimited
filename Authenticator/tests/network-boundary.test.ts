import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

describe("Authenticator network boundary", () => {
  it("limits network access to the dedicated activation client", () => {
    const root = resolve(import.meta.dirname, "..");
    const files = [resolve(root, "App.tsx"), ...sourceFiles(resolve(root, "src"))];
    const fetchUsers = files.filter((path) => /\bfetch\s*\(/.test(readFileSync(path, "utf8")));
    expect(fetchUsers).toEqual([resolve(root, "src", "activation.ts")]);
  });

  it("requires HTTPS and does not persist Office credentials or browser sessions", () => {
    const source = readFileSync(new URL("../src/activation.ts", import.meta.url), "utf8");
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    expect(source).toContain('protocol !== "https:"');
    expect(source).toContain("claim_token");
    expect(source).not.toContain("access_token");
    expect(app).toContain("requestAuthenticatorActivation");
    expect(app).not.toContain("AsyncStorage");
  });
});
