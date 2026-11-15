import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(new URL("../" + relative, import.meta.url), "utf8");
const connect = read("components/office-connect-integrations.tsx");
const backend = read("../Backend/backend/brevo_readiness.py");
const app = read("../Backend/backend/app.py");
const dedicatedWorker = read("../Backend/backend/mail_worker.py");
const env = read("../Backend/backend/.env.example");
const docs = read("../Backend/BREVO_PRODUCTION_RUNBOOK.md");

describe("Office Connect: secure, read-only Brevo readiness and governed dispatch", () => {
  it("does not expose raw Brevo credentials in the Next.js client", () => {
    expect(connect).toContain("/api/office-runtime/integrations/brevo/readiness");
    expect(connect).toContain("Verify sender & domain");
    expect(connect).toContain("No email was sent.");
    expect(connect).toContain("Inbox delivered:");
    expect(connect).not.toContain("BREVO_API_KEY");
    expect(connect).not.toContain("api-key");
    expect(connect).not.toContain("NEXT_PUBLIC_BREVO");
  });
  it("requires Office Owner and performs no provider call unless specifically requested", () => {
    expect(backend).toContain('Depends(require_roles("OWNER"))');
    expect(backend).toContain('include_in_schema=False');
    expect(backend).toContain('def readiness(probe: bool = False');
    expect(backend).toContain("if flags[\"failure_codes\"] or not probe:");
    expect(backend).toContain('"mailbox_delivery_verified": False');
    expect(app).toContain("build_brevo_readiness_router(require_roles)");
  });
  it("allows no default worker sends even when the mail-only container exists", () => {
    expect(env).toContain("KRAVIA_MAIL_WORKER_ENABLED=false");
    expect(env).toContain("KRAVIA_EMPLOYEE_MAIL_DISPATCH_ENABLED=false");
    expect(env).toContain("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED=false");
    expect(env).toContain("KRAVIA_CANDIDATE_MAIL_DISPATCH_ENABLED=false");
    expect(env).toContain("KRAVIA_EXTERNAL_LIFECYCLE_MAIL_DISPATCH_ENABLED=false");
    expect(env).toContain("KRAVIA_INVITATION_NOTICES_ENABLED=false");
    expect(dedicatedWorker).toContain('if not _flag("KRAVIA_MAIL_WORKER_ENABLED"):');
    expect(dedicatedWorker).toContain("process_employee_mail_outbox");
    expect(dedicatedWorker).toContain("process_office_lifecycle_mail_outbox");
    expect(dedicatedWorker).toContain("process_candidate_mail_outbox");
    expect(dedicatedWorker).toContain("process_external_notice_outbox");
    expect(dedicatedWorker).toContain("process_invitation_notices");
    expect(docs).toContain("Do NOT enable all 81 events at once");
  });
});
