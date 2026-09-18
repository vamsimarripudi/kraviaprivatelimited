import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../Database/supabase/migrations/202609180007_device_identity_physical_access.sql", import.meta.url), "utf8");
const adminRead = readFileSync(new URL("../../Database/supabase/migrations/202609180008_device_identity_admin_read.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/device-identity-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-device-identity/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-device-identity.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const workspaces = readFileSync(new URL("../lib/office/workspaces.ts", import.meta.url), "utf8");
const capabilities = readFileSync(new URL("../lib/office/workspace-capabilities.ts", import.meta.url), "utf8");

describe("KRAVIA identity, device trust and physical access", () => {
  it("stores opaque credential digests rather than raw NFC secrets", () => {
    expect(migration).toContain("credential_token_hash");
    expect(migration).toContain("char_length(credential_token_hash)=64");
    expect(server).toContain('randomBytes(32).toString("base64url")');
    expect(server).toContain('createHash("sha256")');
    expect(server).toContain("shown_once: true");
    expect(migration).not.toContain("nfc_secret");
  });

  it("separates identity, device posture and physical-access authority", () => {
    for (const table of [
      "office_identity_credentials",
      "office_device_posture_snapshots",
      "office_physical_access_zones",
      "office_physical_access_grants",
      "office_physical_access_events",
    ]) expect(migration).toContain(table);
    expect(migration).toContain("Self-grant is not allowed");
    expect(migration).toContain("Self-issuance is not allowed");
    expect(migration).toContain("NON_COMPLIANT");
  });

  it("revokes linked physical access when a credential is revoked", () => {
    expect(migration).toContain("update public.office_physical_access_grants set status='REVOKED'");
    expect(migration).toContain("'CREDENTIAL_REVOKED'");
    expect(migration).toContain("'ZONE_REVOKED'");
  });

  it("protects mutations and exposes a capability-scoped workspace", () => {
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(route).toContain("ISSUE_CREDENTIAL");
    expect(route).toContain("RECORD_POSTURE");
    expect(route).toContain("GRANT_ZONE");
    expect(component).toContain("One company identity across software, devices and future office access.");
    expect(screen).toContain("OfficeDeviceIdentity");
    expect(workspaces).toContain('devices: { title: "Identity & devices"');
    expect(capabilities).toContain('"office:devices"');
    expect(capabilities).toContain("physical.access.manage");
  });

  it("gives delegated Office administration company-scoped credential visibility", () => {
    expect(adminRead).toContain("OFFICE_ADMIN");
    expect(adminRead).toContain("identity.card.read");
    expect(adminRead).toContain("COMPANY");
  });
});
