import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authServer = readFileSync(new URL("../lib/office/auth-server.ts", import.meta.url), "utf8");
const accessAdmin = readFileSync(new URL("../lib/office/access-admin.ts", import.meta.url), "utf8");
const accessRecovery = readFileSync(new URL("../lib/office/access-recovery.ts", import.meta.url), "utf8");
const accessPanel = readFileSync(new URL("../components/access-governance-panel.tsx", import.meta.url), "utf8");
const lifecycleSql = readFileSync(new URL("../office/spec/identity/SUPABASE_INVITATION_LIFECYCLE.sql", import.meta.url), "utf8");
const officeEnv = readFileSync(new URL("../lib/env/office.ts", import.meta.url), "utf8");

describe("KRAVIA Office invitation lifecycle", () => {
  it("stages invited identities without granting workspace access before acceptance", () => {
    expect(accessAdmin).toContain('status:"INVITED"');
    expect(authServer).toContain('identity.accessStatus!=="INVITED"');
    expect(authServer).toContain('identity.accessStatus==="ACTIVE"');
    expect(accessPanel).toContain('user.status==="INVITED"');
    expect(accessPanel).toContain("Pending invitation — no workspace access exists yet");
  });

  it("accepts invitations atomically through the controlled service-role RPC", () => {
    expect(accessRecovery).toContain('.rpc("office_accept_invitation"');
    expect(lifecycleSql).toContain("office_accept_invitation");
    expect(lifecycleSql).toContain("status='INVITED'");
    expect(lifecycleSql).toContain("status='ACTIVE'");
    expect(lifecycleSql).toContain("INVITE_ACCEPTED");
  });

  it("preserves immutable access audit identity snapshots", () => {
    expect(lifecycleSql).toContain("drop constraint if exists office_access_audit_actor_user_id_fkey");
    expect(lifecycleSql).toContain("drop constraint if exists office_access_audit_target_user_id_fkey");
    expect(lifecycleSql).toContain("account deletion cannot mutate immutable audit history");
  });

  it("keeps the trusted Supabase administration credential server-only", () => {
    expect(officeEnv).toContain("OFFICE_SUPABASE_SECRET_KEY");
    expect(officeEnv).not.toContain("NEXT_PUBLIC_OFFICE_SUPABASE_SECRET_KEY");
    expect(accessAdmin).not.toContain("NEXT_PUBLIC_");
  });
});
