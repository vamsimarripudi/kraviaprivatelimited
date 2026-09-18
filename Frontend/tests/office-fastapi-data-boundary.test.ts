import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const backendModelFiles = [
  new URL("../../Backend/backend/models.py", import.meta.url),
  new URL("../../Backend/backend/finance_models.py", import.meta.url),
  new URL("../../Backend/backend/period_controls.py", import.meta.url),
];

function fastApiOwnedTables() {
  const tables = new Set<string>();
  for (const file of backendModelFiles) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(/__tablename__\s*=\s*["']([^"']+)["']/g)) {
      tables.add(match[1]);
    }
  }
  return tables;
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory()
      ? filesUnder(path)
      : path.endsWith(".ts") || path.endsWith(".tsx")
        ? [path]
        : [];
  });
}

describe("KRAVIA Office FastAPI data ownership boundary", () => {
  it("does not query SQLAlchemy-owned business tables directly through Supabase", () => {
    const tables = fastApiOwnedTables();
    expect(tables.size).toBeGreaterThan(50);

    const root = resolve(import.meta.dirname, "../lib/office");
    const violations: string[] = [];

    for (const path of filesUnder(root)) {
      const content = readFileSync(path, "utf8");
      for (const match of content.matchAll(/\.from\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
        if (tables.has(match[1])) {
          violations.push(`${relative(root, path)} -> ${match[1]}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps browser business-data access behind the fixed-origin Office runtime gateway", () => {
    const gateway = readFileSync(
      new URL("../app/api/office-runtime/[...path]/route.ts", import.meta.url),
      "utf8",
    );
    expect(gateway).toContain("officeMutationIsSameOrigin(request)");
    expect(gateway).toContain("getOfficeRuntimeOrigin()");
    expect(gateway).toContain('headers.set("Authorization"');
    expect(gateway).toContain('headers.set("X-Kravia-Gateway"');
    expect(gateway).toContain('redirect: "manual"');
  });
});
