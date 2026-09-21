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

describe("KRAVIA Authenticator offline source boundary", () => {
  it("does not contain application network clients or telemetry transports", () => {
    const root = resolve(import.meta.dirname, "..");
    const files = [
      resolve(root, "App.tsx"),
      ...sourceFiles(resolve(root, "src")),
    ];
    const violations = files.flatMap((path) => {
      const source = readFileSync(path, "utf8");
      const markers = [
        /\bfetch\s*\(/,
        /\bXMLHttpRequest\b/,
        /\bWebSocket\b/,
        /\bEventSource\b/,
        /from\s+["']axios["']/,
        /from\s+["']expo-network["']/,
        /from\s+["']@sentry\//,
      ];
      return markers.some((pattern) => pattern.test(source)) ? [path] : [];
    });
    expect(violations).toEqual([]);
  });
});
