import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}
const schema = source("../Database/supabase/migrations/202611130032_candidate_lifecycle_delivery.sql");
const backend = source("../Backend/backend/office_candidate_lifecycle_mail_worker.py");
const delivery = source("../Backend/backend/email_delivery.py");
const worker = source("../Backend/backend/worker.py");
const server = source("lib/office/recruitment-server.ts");
const route = source("app/api/office-recruitment/route.ts");
const ui = source("components/office-recruitment-workspace.tsx");

describe("Separate, opt-in external candidate communication boundary", () => {
  it("requires Owner-attested candidate-provided contact evidence before delivery", () => {
    expect(schema).toContain("office_candidate_contact_authorizations");
    expect(schema).toContain("'CANDIDATE_EMAIL_REPLY'");
    expect(schema).toContain("r.role='OWNER'");
    expect(schema).toContain("authority.revoked_at IS NULL");
    expect(schema).toContain("candidate.email=o.recipient_email");
    expect(schema).toContain("UNIQUE(event_code,source_event_id,candidate_id)");
    expect(schema).toContain("status='UNKNOWN'");
    expect(schema).toContain("FOR UPDATE OF o SKIP LOCKED");
    expect(schema).toContain("source_ready)<>67");
    expect(schema).toContain("no external sends");
  });
  it("keeps private candidate addresses separate from the employee mail worker", () => {
    expect(backend).toContain("KRAVIA_CANDIDATE_LIFECYCLE_MAIL_DISPATCH_ENABLED");
    expect(backend).toContain("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED");
    expect(backend).toContain("validate_candidate_claim");
    expect(backend).toContain("office_candidate_lifecycle_claim");
    expect(worker).toContain("process_candidate_lifecycle_mail_outbox");
    expect(delivery).toContain("send_office_candidate_lifecycle_notification");
    expect(delivery).not.toContain("candidate_email: raw_html");
  });
  it("offers explicit Owner authorization without sending any employee or candidate email", () => {
    expect(server).toContain('permission("hiring.candidate.manage")');
    expect(server).toContain('roles.includes("OWNER")');
    expect(server).toContain('rpc("office_candidate_contact_authorize"');
    expect(route).toContain('action: z.literal("AUTHORIZE_CANDIDATE_CONTACT")');
    expect(route).toContain("officeMutationIsSameOrigin(request)");
    expect(ui).toContain("Candidate notification delivery remains disabled");
    expect(ui).toContain("CANDIDATE_CONTACT");
  });
});