import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const deviceSql = readFileSync(new URL("../../Backend/spec/identity/SUPABASE_DEVICE_BINDING.sql", import.meta.url), "utf8");
const deviceServer = readFileSync(new URL("../lib/office/device-binding-server.ts", import.meta.url), "utf8");
const permissionEngine = readFileSync(new URL("../lib/office/permission-engine.ts", import.meta.url), "utf8");
const deviceRoute = readFileSync(new URL("../app/api/office-auth/device/route.ts", import.meta.url), "utf8");

describe("KRAVIA Office trusted-device binding", () => {
  it("binds only administrator-approved company-managed devices", () => {
    expect(deviceSql).toContain("trust_state<>'TRUSTED'");
    expect(deviceSql).toContain("company_managed is not true");
    expect(deviceSql).toContain("office_bind_trusted_device");
  });

  it("stores only a SHA-256 binding-token hash and clears it when a device is revoked", () => {
    expect(deviceSql).toContain("binding_token_hash");
    expect(deviceSql).toContain("SHA-256");
    expect(deviceSql).toContain("office_device_clear_binding_on_revoke");
    expect(deviceServer).toContain('createHash("sha256")');
    expect(deviceServer).not.toContain("binding_token:");
  });

  it("uses an HttpOnly Strict cookie and validates the binding through the service authority", () => {
    expect(deviceServer).toContain('httpOnly: true');
    expect(deviceServer).toContain('sameSite: "strict"');
    expect(deviceServer).toContain("office_validate_device_binding");
    expect(deviceSql).toContain("grant execute on function public.office_validate_device_binding");
  });

  it("does not let OWNER authority bypass an active permission's device policy", () => {
    const permissionLookup = permissionEngine.indexOf('office_permission_catalog');
    const ownerBranch = permissionEngine.indexOf('identity.roles.includes("OWNER")');
    expect(permissionLookup).toBeGreaterThan(-1);
    expect(ownerBranch).toBeGreaterThan(permissionLookup);
    expect(permissionEngine).toContain("currentOfficeTrustedDeviceId");
    expect(permissionEngine).toContain("A trusted company-managed device is required");
  });

  it("records device binding against the first-party identity runtime rather than the legacy session ledger", () => {
    expect(deviceServer).toContain('"/api/v1/auth/device-event"');
    expect(deviceServer).toContain('"LINKED"');
    expect(deviceServer).toContain('"UNLINKED"');
    expect(deviceServer).not.toContain('from("office_auth_sessions")');
    expect(deviceServer).not.toContain("office_record_auth_session_event");
    expect(deviceServer).not.toContain("trackedOfficeSessionId");
  });

  it("revalidates the current first-party actor before privileged device writes", () => {
    expect(deviceServer).toContain("getOfficeSessionContext");
    expect(deviceServer).toContain("officeIdentityIsProvisioned");
    expect(deviceServer).toContain("requireCurrentDeviceActor");
    expect(deviceServer).toContain("context.identity.userId !== userId");
    expect(deviceServer).toContain("context.session.access_token !== accessToken");
  });

  it("requires AAL2 and same-origin mutation protection for device binding", () => {
    expect(deviceRoute).toContain("officeMutationIsSameOrigin");
    expect(deviceRoute).toContain('context.identity.aal !== "aal2"');
    expect(deviceRoute).toContain("context.session.access_token");
    expect(deviceRoute).toContain("bindCurrentOfficeDevice");
  });
});
