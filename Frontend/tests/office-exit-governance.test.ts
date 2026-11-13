import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const file = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const api = file("app/api/office-exit-governance/route.ts");
const screen = file("components/office-exit-governance.tsx");
const workforce = file("components/office-workforce-lifecycle.tsx");
const sql = file("../Database/supabase/migrations/202611130035_governed_offboarding_contact_evidence.sql");
const worker = file("../Backend/backend/office_external_notice_worker.py");

describe("KRAVIA Office audited leaver actions", () => {
  it("authorizes AAL2 People and Owner operations and rejects cross-origin mutations", () => {
    expect(api).toContain("requireOfficeActor()");
    expect(api).toContain('resolveOfficePermission(current.admin, current.identity, "people.update"');
    expect(api).toContain("officeMutationIsSameOrigin(request)");
    expect(api).toContain('OfficePermissionError(403, "Separate Owner approval required")');
    expect(api).toContain('OfficePermissionError(403, "People and Finance permissions required');
    expect(api).toContain('"Cache-Control": "private, no-store"');
    expect(api).not.toContain("send_email");
    expect(api).not.toContain("send_office_lifecycle");
  });
  it("keeps explicit former-employee contact versioning and two-person verification", () => {
    expect(sql).toContain("reviewed_by<>recorded_by");
    expect(sql).toContain("office_exit_contact_recipient");
    expect(sql).toContain("expires_at>now()");
    expect(api).toContain("office_exit_contact_record");
    expect(api).toContain("office_exit_contact_decide");
    expect(api).toContain("office_exit_contact_revoke");
    expect(screen).toContain("SIGNED_EMPLOYMENT_CONSENT");
    expect(screen).toContain("evidence_reference");
  });
  it("does not treat compensation or exit completion as automatic provider delivery", () => {
    expect(api).toContain("office_exit_settlement_open");
    expect(api).toContain("office_exit_settlement_verify");
    expect(api).toContain("office_exit_completion_record");
    expect(screen).toContain("No email or payment was sent");
    expect(workforce).toContain("<OfficeExitGovernance");
    expect(worker).toContain("KRAVIA_EXTERNAL_LIFECYCLE_MAIL_DISPATCH_ENABLED");
    expect(worker).toContain("office_external_notice_can_send");
    expect(worker).toContain('"UNKNOWN"');
  });
});
