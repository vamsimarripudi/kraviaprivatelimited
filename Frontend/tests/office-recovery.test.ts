import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authServerSource = readFileSync(new URL("../lib/office/auth-server.ts", import.meta.url), "utf8");
const confirmSource = readFileSync(new URL("../app/office/recover/confirm/route.ts", import.meta.url), "utf8");
const passwordSource = readFileSync(new URL("../app/api/office-auth/recovery/password/route.ts", import.meta.url), "utf8");
const adminRecoverySource = readFileSync(new URL("../app/api/office-access/password-recovery/route.ts", import.meta.url), "utf8");
const recoveryPage = readFileSync(new URL("../app/office/recover/page.tsx", import.meta.url), "utf8");
const resetPage = readFileSync(new URL("../app/office/reset-password/page.tsx", import.meta.url), "utf8");
const recoveryForm = readFileSync(new URL("../components/office-password-recovery-form.tsx", import.meta.url), "utf8");

describe("KRAVIA Office controlled recovery", () => {
  it("does not expose a Supabase password-recovery fallback", () => {
    expect(authServerSource).not.toContain("resetPasswordForEmail");
    expect(authServerSource).not.toContain('type: "recovery"');
    expect(passwordSource).not.toContain("updateUser");
    expect(adminRecoverySource).not.toContain("Supabase");
  });

  it("keeps recovery same-origin and administrator-issued", () => {
    expect(adminRecoverySource).toContain("officeMutationIsSameOrigin(request)");
    expect(passwordSource).toContain("officeMutationIsSameOrigin(request)");
    expect(recoveryPage).toContain("short-lived, single-use recovery link");
    expect(recoveryPage).toContain("No email or SMS provider is required");
    expect(recoveryPage).toContain("OWNER recovery remains outside ordinary delegated administration");
  });

  it("retires legacy provider callbacks while activating the KRAVIA reset page", () => {
    expect(confirmSource).toContain('"/office/recover"');
    expect(confirmSource).not.toContain("token_hash");
    expect(resetPage).toContain("OfficePasswordRecoveryForm");
    expect(resetPage).toContain('referrer: "no-referrer"');
    expect(recoveryForm).toContain("window.history.replaceState");
    expect(recoveryForm).toContain("/api/office-auth/recovery/password");
  });
});
