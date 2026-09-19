import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authServerSource = readFileSync(new URL("../lib/office/auth-server.ts", import.meta.url), "utf8");
const requestSource = readFileSync(new URL("../app/api/office-auth/recovery/request/route.ts", import.meta.url), "utf8");
const confirmSource = readFileSync(new URL("../app/office/recover/confirm/route.ts", import.meta.url), "utf8");
const passwordSource = readFileSync(new URL("../app/api/office-auth/recovery/password/route.ts", import.meta.url), "utf8");
const recoveryPage = readFileSync(new URL("../app/office/recover/page.tsx", import.meta.url), "utf8");

describe("KRAVIA Office controlled recovery", () => {
  it("does not expose a Supabase password-recovery fallback", () => {
    expect(authServerSource).not.toContain("resetPasswordForEmail");
    expect(authServerSource).not.toContain('type: "recovery"');
    expect(requestSource).not.toContain("NEXT_PUBLIC_SITE_URL");
    expect(passwordSource).not.toContain("updateUser");
  });

  it("keeps recovery same-origin and administrator-assisted", () => {
    expect(requestSource).toContain("officeMutationIsSameOrigin(request)");
    expect(requestSource).toContain("administrator-assisted");
    expect(recoveryPage).toContain("Contact your Office administrator");
    expect(recoveryPage).toContain("Founder");
  });

  it("retires legacy provider recovery callbacks", () => {
    expect(confirmSource).toContain('"/office/recover"');
    expect(confirmSource).not.toContain("token_hash");
    expect(passwordSource).toContain("controlled KRAVIA Office recovery process");
  });
});
