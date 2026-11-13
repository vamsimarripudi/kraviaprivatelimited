import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}
const exitApi = read("app/api/office-exit-governance/route.ts");
const exitPanel = read("components/office-exit-governance.tsx");
const studio = read("components/office-document-studio.tsx");
const ownerPolicy = read("app/api/office-lifecycle-mail-policy/route.ts");
const documentRoute = read("app/api/office-documents/route.ts");
const documentServer = read("lib/office/document-studio-server.ts");
const externalWorker = read("../Backend/backend/office_external_notice_worker.py");
const signingState = read("../Database/supabase/migrations/202611130111_document_signing_request_state_correction.sql");
const signingProof = read("../Database/supabase/migrations/202611130109_signing_provider_link_source_evidence.sql");
const sourceMapping = read("../Database/supabase/migrations/202611130110_external_lifecycle_notice_private_outbox.sql");

describe("KRAVIA Office external signing and offboarding audit gates", () => {
  it("never presents local record-entry as actual third-party eSign issuance", () => {
    expect(studio).toContain("Record issued eSign request");
    expect(studio).not.toContain("Issue provider eSign request");
    expect(studio).toContain("Issue this request in your verified eSign provider first.");
    expect(studio).toContain("KRAVIA does not fabricate signing links or email tokens.");
    expect(signingState).toContain("SET status='SIGNING'");
    expect(signingState).toContain("Existing unexpired signing request must not be reissued");
    expect(studio).toContain("Record renewed eSign request");
    expect(signingState).toContain("link_expires_at");
    expect(signingProof).toContain("template.template_code='HR_APPOINTMENT'");
    expect(signingProof).toContain("document.signed_at IS NULL");
    expect(signingProof).toContain("delivery.metadata->>'link_expires_at'");
  });
  it("requires current authenticated Office authority and deliberate explicit consent", () => {
    expect(exitApi).toContain("await requireOfficeActor()");
    expect(exitApi).toContain("officeMutationIsSameOrigin(request)");
    expect(exitApi).toContain("office_exit_contact_record");
    expect(exitApi).toContain("office_exit_contact_decide");
    expect(exitApi).toContain("office_exit_contact_revoke");
    expect(exitApi).toContain("office_exit_settlement_verify");
    expect(exitApi).toContain("office_exit_completion_record");
    expect(exitApi).toContain("recipient: auth.owner ? row.personal_email : masked(row.personal_email)");
    expect(exitPanel).toContain("Record explicit contact consent");
    expect(exitPanel).toContain("No email or payment was sent.");
  });
  it("enforces independent, revocable Owner attestation of issued signing references", () => {
    expect(sourceMapping).toContain("office_signing_issuance_review");
    expect(sourceMapping).toContain("office_signing_issuance_revoke");
    expect(sourceMapping).toContain("office_onboarding_signing_domain_evidence_valid");
    expect(sourceMapping).toContain("review.status=\'VERIFIED\'");
    expect(documentRoute).toContain("REVIEW_SIGNING_ISSUANCE");
    expect(documentRoute).toContain("REVOKE_SIGNING_ISSUANCE");
    expect(documentServer).toContain("Independent Owner verification required");
    expect(studio).toContain("Review provider issuance");
    expect(studio).toContain("Provider audit evidence reference");
  });
  it("keeps all seven external notice routes in an isolated disabled worker", () => {
    for (const code of ["ONB-04","EXIT-02","EXIT-04","EXIT-05","EXIT-06","EXIT-07","EXIT-08"]) {
      expect(sourceMapping).toContain(code);
    }
    expect(sourceMapping).toContain("source_ready=true");
    expect(sourceMapping).toContain("AND source_ready=false AND enabled=false");
    expect(sourceMapping).toContain("EXTERNAL_NOTICE_WORKER");
    expect(sourceMapping).toContain("office_external_notice_source_valid");
    expect(sourceMapping).toContain("office_external_notice_recipient");
    expect(sourceMapping).toContain("office_external_notice_can_send");
    expect(sourceMapping).toContain("p_id uuid,p_token uuid,p_recipient_email text");
    expect(sourceMapping).toContain("pg_catalog.btrim(p_recipient_email)");
    expect(sourceMapping).toContain("STALE_UNKNOWN");
    expect(sourceMapping).not.toContain("SET enabled=true");
    expect(externalWorker).toContain("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED");
    expect(externalWorker).toContain("KRAVIA_EXTERNAL_LIFECYCLE_MAIL_DISPATCH_ENABLED");
    expect(externalWorker).toContain("office_external_notice_can_send");
    expect(ownerPolicy).toContain("office_lifecycle_mail_policy_set");
    expect(ownerPolicy).toContain('ownership.data.delivery_owner==="FIRST_PARTY_AUTH"');
  });
});
