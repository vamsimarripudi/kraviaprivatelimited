import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serverEnvironmentSource = readFileSync(new URL("../lib/env/server.ts", import.meta.url), "utf8");

describe("website Supabase admin environment", () => {
  it("requires only the server-side URL and secret for privileged database calls", () => {
    const adminEnvironmentSource = serverEnvironmentSource.slice(
      serverEnvironmentSource.indexOf("export function getSupabaseAdminEnvironment"),
      serverEnvironmentSource.indexOf("/** Returns only a verified pooled Neon URL"),
    );

    expect(serverEnvironmentSource).toContain("const supabaseAdminEnvironmentSchema");
    expect(adminEnvironmentSource).toContain("NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(adminEnvironmentSource).toContain("SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY");
    expect(adminEnvironmentSource).not.toContain("getPublicSupabaseEnvironment");
    expect(adminEnvironmentSource).not.toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });
});
