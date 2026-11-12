import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const endpoint = readFileSync(new URL("../app/api/office-employee-mail-policy/route.ts",import.meta.url),"utf8");
const controls = readFileSync(new URL("../components/office-employee-mail-controls.tsx",import.meta.url),"utf8");
const settings = readFileSync(new URL("../components/office-settings-hub.tsx",import.meta.url),"utf8");
const sql = readFileSync(new URL("../../Database/supabase/migrations/202611130021_office_employee_mail_delivery_worker.sql",import.meta.url),"utf8");
const worker = readFileSync(new URL("../../Backend/backend/office_employee_mail_worker.py",import.meta.url),"utf8");

describe("KRAVIA Office authorised employee notification delivery",()=>{
  it("requires real AAL2 corporate Owner identity, same-origin and approved reason",()=>{
    expect(endpoint).toContain("await requireOfficeActor()");
    expect(endpoint).toContain('identity.roles.includes("OWNER")');
    expect(endpoint).toContain("officeMutationIsSameOrigin");
    expect(endpoint).toContain("z.string().trim().min(12).max(500)");
    expect(endpoint).toContain('p_actor:actor.identity.userId');
    expect(endpoint).toContain('p_effective_from:parsed.data.enabled?new Date().toISOString():null');
    expect(endpoint).not.toContain("BREVO_API_KEY");
    expect(endpoint).not.toContain("send_office");
  });
  it("never treats a disabled policy, old employee ID or unknown mail as successful",()=>{
    expect(sql).toContain("VALUES('EMPLOYEE_ID_ISSUED',false)");
    expect(sql).toContain("o.created_at>=policy.effective_from");
    expect(sql).toContain("status='UNKNOWN'");
    expect(sql).toContain("FOR UPDATE OF o SKIP LOCKED");
    expect(sql).toContain("p.status='VERIFIED'");
    expect(sql).toContain("e.status='ACTIVE'");
    expect(sql).toContain("pg_catalog.lower(a.email)=pg_catalog.lower(o.recipient_email)");
    expect(sql).toContain("TO kravia_office_backend");
    expect(sql).toContain("FROM PUBLIC,anon,authenticated,service_role");
    expect(worker).toContain('KRAVIA_EMPLOYEE_MAIL_DISPATCH_ENABLED');
    expect(worker).toContain('"PROVIDER_NOT_CONFIGURED"');
  });
  it("only makes policy management visible to the Owner and does not send email on click",()=>{
    expect(settings).toContain('identity.roles.includes("OWNER")');
    expect(settings).toContain('<OfficeEmployeeMailControls/>');
    expect(controls).toContain("I have verified the Brevo worker configuration");
    expect(controls).toContain("No historical messages are dispatched");
    expect(controls).toContain('method:"POST"');
    expect(controls).not.toContain("api.brevo.com");
    expect(controls).not.toContain("send_office");
  });
});
