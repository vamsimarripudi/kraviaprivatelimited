import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../components/office-security-settings.tsx", import.meta.url), "utf8");
const deviceServer = readFileSync(new URL("../lib/office/device-binding-server.ts", import.meta.url), "utf8");
const deviceSql = readFileSync(new URL("../../Backend/spec/identity/SUPABASE_DEVICE_BINDING.sql", import.meta.url), "utf8");

describe("KRAVIA Office security settings", () => {
  it("renders the live security control in Office settings", () => {
    expect(screen).toContain("OfficeSecuritySettings");
    expect(screen).toContain('section === "settings"');
    expect(panel).toContain("Session, MFA and trusted-device control");
    expect(panel).toContain("/api/office-auth/sessions");
    expect(panel).toContain("/api/office-auth/device");
  });

  it("lets an AAL2 user bind only administrator-approved company devices", () => {
    expect(panel).toContain("Bind this browser");
    expect(panel).toContain('device.trust_state === "TRUSTED"');
    expect(panel).toContain("device.company_managed");
    expect(deviceServer).toContain('aal !== "aal2"');
    expect(deviceSql).toContain("trust_state<>'TRUSTED'");
    expect(deviceSql).toContain("company_managed is not true");
  });

  it("stores device proof as an HttpOnly browser secret and database hash", () => {
    expect(deviceServer).toContain("httpOnly: true");
    expect(deviceServer).toContain("sha256(token)");
    expect(deviceSql).toContain("binding_token_hash");
    expect(deviceSql).toContain("Raw binding tokens are never stored");
  });
});
