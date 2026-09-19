import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authz = readFileSync(new URL("../lib/corporate/authorization.ts", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/corporate/layout.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../components/corporate-login-form.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../components/corporate-profile-settings.tsx", import.meta.url), "utf8");
const activity = readFileSync(new URL("../app/api/corporate/activity/route.ts", import.meta.url), "utf8");
const upload = readFileSync(new URL("../app/api/corporate/documents/upload/route.ts", import.meta.url), "utf8");

describe("legacy Corporate Office retirement", () => {
  it("routes browser traffic into KRAVIA Office", () => {
    expect(layout).toContain('redirect("/office/dashboard")');
    expect(login).toContain('href="/office/login"');
    expect(profile).toContain('href="/office/access"');
  });

  it("cannot authenticate through Supabase Auth", () => {
    for (const source of [authz, login, profile]) {
      expect(source).not.toContain("supabase.auth");
      expect(source).not.toContain("createBrowserSupabaseClient");
      expect(source).not.toContain("@/lib/supabase/auth");
    }
    expect(authz).toContain("Legacy Corporate Office has moved to KRAVIA Office.");
  });

  it("fails closed for legacy tracking and document upload APIs", () => {
    expect(activity).toContain("status: 410");
    expect(upload).toContain("status: 410");
    expect(upload).not.toContain("storage.from");
  });
});
