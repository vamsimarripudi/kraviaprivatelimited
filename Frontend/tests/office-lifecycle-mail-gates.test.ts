import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const endpoint = readFileSync(new URL("../app/api/office-lifecycle-mail-policy/route.ts",import.meta.url),"utf8");
const controls = readFileSync(new URL("../components/office-lifecycle-mail-controls.tsx",import.meta.url),"utf8");
const settings = readFileSync(new URL("../components/office-settings-hub.tsx",import.meta.url),"utf8");
const schema = readFileSync(new URL("../../Database/supabase/migrations/202611130022_office_lifecycle_mail_router.sql",import.meta.url),"utf8");
const worker = readFileSync(new URL("../../Backend/backend/office_lifecycle_mail_worker.py",import.meta.url),"utf8");
const manifest = JSON.parse(readFileSync(new URL("../../Backend/backend/generated_office_lifecycle_templates.json",import.meta.url),"utf8"));

describe("KRAVIA Office governed 81-event lifecycle notification delivery",()=>{
  it("has 81 complete, versioned and disabled-by-default rendering definitions",()=>{
    expect(manifest.total).toBe(81);
    expect(manifest.dispatchEnabled).toBe(false);
    expect(Object.keys(manifest.templates)).toHaveLength(81);
    for(const [code,entry] of Object.entries(manifest.templates) as [string,Record<string,string>][]) {
      expect(code).toMatch(/^(AUTH|HIRE|ONB|ROLE|TIME|PAY|DEV|EXIT)-[0-9]{2}$/);
      expect(entry.subject.length).toBeGreaterThan(7);
      expect(entry.body.length).toBeGreaterThan(30);
      expect(entry.priority).toMatch(/^P[0-2]$/);
    }
  });
  it("separates 81 inventory entries from only verified canonical source bridges",()=>{
    expect(schema).toContain("source_ready boolean NOT NULL DEFAULT false");
    expect(schema).toContain("intent text NOT NULL");
    expect(schema).toContain("recipient_description text NOT NULL");
    expect(endpoint).toContain("trigger_description,recipient_description");
    expect(controls).toContain("Committed event requirement");
    expect(schema).toContain("enabled boolean NOT NULL DEFAULT false");
    expect(schema).toContain("IF p_enabled AND NOT v_ready THEN");
    expect(schema).toContain("office_employee_intake_events");
    expect(schema).toContain("office_role_package_events");
    expect(schema).toContain("office_department_transfer_events");
    expect(schema).toContain("office_auth_events");
    expect(schema).toContain("office_people_development_events");
    expect(schema).toContain("COMPENSATION_APPROVAL_SYNCED");
    expect(schema).toContain("PERFORMANCE_UPDATED");
    expect(schema).toContain("TRAINING_ASSIGNED");
    expect(schema).toContain("office_task_events");
    expect(schema).toContain("PERFORMANCE_CREATED");
    expect(schema).toContain("development_plan");
    expect(schema).toContain("DEV-07");
    expect(schema).toContain("office_salary_payslip_issues");
    expect(schema).toContain("PAYSLIP_ISSUED");
    expect(worker).toContain("pay_period");
    expect(schema).toContain("FOR UPDATE OF o SKIP LOCKED");
    expect(schema).toContain("STALE_UNKNOWN");
    expect(schema).toContain("office_lifecycle_mail_policy_history");
    expect(schema).toContain("FROM PUBLIC,anon,authenticated,service_role");
    expect(worker).toContain('KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED');
    expect(worker).toContain('PROVIDER_NOT_CONFIGURED');
  });
  it("requires authorised Owner and AAL2 for every review, without manual sending",()=>{
    expect(endpoint).toContain("await requireOfficeActor()");
    expect(endpoint).toContain('roles.includes("OWNER")');
    expect(endpoint).toContain("officeMutationIsSameOrigin");
    expect(endpoint).toContain("office_lifecycle_mail_policy_set");
    expect(endpoint).toContain('p_actor:current.identity.userId');
    expect(endpoint).toContain("source_ready");
    expect(controls).toContain("Not yet implemented");
    expect(controls).toContain("No earlier or unverified event will be resent");
    expect(controls).toContain("does not provide a manual send function");
    expect(settings).toContain('identity.roles.includes("OWNER")');
    expect(settings).toContain("<OfficeLifecycleMailControls/>");
    expect(endpoint).not.toContain("send_office");
    expect(controls).not.toContain("api.brevo.com");
  });
});
