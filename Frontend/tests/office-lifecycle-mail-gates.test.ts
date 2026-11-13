import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const endpoint = readFileSync(new URL("../app/api/office-lifecycle-mail-policy/route.ts",import.meta.url),"utf8");
const controls = readFileSync(new URL("../components/office-lifecycle-mail-controls.tsx",import.meta.url),"utf8");
const settings = readFileSync(new URL("../components/office-settings-hub.tsx",import.meta.url),"utf8");
const schema = readFileSync(new URL("../../Database/supabase/migrations/202611130022_office_lifecycle_mail_router.sql",import.meta.url),"utf8");
const forward = readFileSync(new URL("../../Database/supabase/migrations/202611130024_reconcile_office_lifecycle_additional_routes.sql",import.meta.url),"utf8");
// The recorded 022 migration is immutable; test the effective 022 + 024 schema.
const nextSources = readFileSync(new URL("../../Database/supabase/migrations/202611130025_auth_asset_lifecycle_sources.sql",import.meta.url),"utf8");
const deviceAtomicity = readFileSync(new URL("../../Database/supabase/migrations/202611130026_auth_device_decision_atomicity.sql",import.meta.url),"utf8");
const workforce = readFileSync(new URL("../../Database/supabase/migrations/202611130027_workforce_lifecycle_verified_sources.sql",import.meta.url),"utf8");
const scheduled = readFileSync(new URL("../../Database/supabase/migrations/202611130028_scheduled_lifecycle_verified_sources.sql",import.meta.url),"utf8");
const controlled = readFileSync(new URL("../../Database/supabase/migrations/202611130029_policy_documents_flex_sources.sql",import.meta.url),"utf8");
const workdayExit = readFileSync(new URL("../../Database/supabase/migrations/202611130030_workday_attendance_offboarding_notifications.sql",import.meta.url),"utf8");
const transactionalAuth = readFileSync(new URL("../../Database/supabase/migrations/202611130031_existing_transactional_auth_delivery_ownership.sql",import.meta.url),"utf8");
const existingAuthDelivery = readFileSync(new URL("../../Backend/backend/email_delivery.py",import.meta.url),"utf8");
const existingAuthRouter = readFileSync(new URL("../../Backend/backend/identity_auth.py",import.meta.url),"utf8");
const effectiveSchema = schema + "\n" + forward + "\n" + nextSources + "\n" + deviceAtomicity + "\n" + workforce + "\n" + scheduled + "\n" + controlled;
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
    expect(effectiveSchema).toContain("source_ready boolean NOT NULL DEFAULT false");
    expect(effectiveSchema).toContain("intent text NOT NULL");
    expect(effectiveSchema).toContain("recipient_description text NOT NULL");
    expect(endpoint).toContain("trigger_description,recipient_description");
    expect(controls).toContain("Committed event requirement");
    expect(effectiveSchema).toContain("enabled boolean NOT NULL DEFAULT false");
    expect(effectiveSchema).toContain("IF p_enabled AND NOT v_ready THEN");
    expect(effectiveSchema).toContain("office_employee_intake_events");
    expect(effectiveSchema).toContain("office_role_package_events");
    expect(effectiveSchema).toContain("office_department_transfer_events");
    expect(effectiveSchema).toContain("office_auth_events");
    expect(effectiveSchema).toContain("office_people_development_events");
    expect(effectiveSchema).toContain("COMPENSATION_APPROVAL_SYNCED");
    expect(effectiveSchema).toContain("PERFORMANCE_UPDATED");
    expect(effectiveSchema).toContain("TRAINING_ASSIGNED");
    expect(effectiveSchema).toContain("TRAINING_UPDATED");
    expect(effectiveSchema).toContain("office_lifecycle_mail_decision_events");
    expect(effectiveSchema).toContain("office_flex_day_requests");
    expect(effectiveSchema).toContain("office_worktime_policy_versions");
    expect(effectiveSchema).toContain("completion_evidence_reference");
    expect(effectiveSchema).toContain("office_task_events");
    expect(effectiveSchema).toContain("PERFORMANCE_CREATED");
    expect(effectiveSchema).toContain("development_plan");
    expect(effectiveSchema).toContain("DEV-07");
    expect(effectiveSchema).toContain("office_salary_payslip_issues");
    expect(effectiveSchema).toContain("office_salary_settlement_evidence");
    expect(effectiveSchema).toContain("BANK_SALARY_CREDIT_VERIFIED");
    expect(effectiveSchema).toContain("v_paid=v_result.net_pay_minor");
    expect(effectiveSchema).toContain("PAYSLIP_ISSUED");
    expect(effectiveSchema).toContain("BANK_SALARY_PARTIAL_VERIFIED");
    expect(effectiveSchema).toContain("ONB-10");
    expect(effectiveSchema).toContain("ONB-01");
    expect(forward).toContain("source_ready)<>33");
    expect(nextSources).toContain("source_ready)<>37");
    expect(nextSources).toContain("office_auth_events_v2");
    expect(nextSources).toContain("office_asset_events");
    expect(nextSources).toContain("office_login_device_approvals");
    expect(nextSources).toContain("ONB-07");
    expect(nextSources).toContain("AUTH-09");
    expect(deviceAtomicity).toContain("CREATE OR REPLACE FUNCTION public.office_lifecycle_auth_v2_source");
    expect(deviceAtomicity).not.toContain("IF v_code=\'AUTH-07\'");
    expect(workforce).toContain("source_ready)<>43");
    for(const code of ["AUTH-12","EXIT-03","TIME-05","TIME-06","ROLE-07","ROLE-03"]){
      expect(workforce).toContain(code);
    }
    expect(workforce).toContain("office_attendance_sessions");
    expect(workforce).toContain("office_access_reviews");
    expect(workforce).toContain("office_effective_permission");
    expect(workforce).not.toContain("SET enabled=true");
    expect(scheduled).toContain("source_ready)<>49");
    expect(scheduled).toContain("office_lifecycle_reminder_tick");
    for(const code of ["DEV-02","ONB-06","ONB-11","ONB-12","PAY-10","TIME-10"]){
      expect(scheduled).toContain(code);
    }
    expect(scheduled).toContain("status='VERIFIED'");
    expect(scheduled).not.toContain("SET enabled=true");
    expect(controlled).toContain("source_ready)<>57");
    expect(workdayExit).toContain("source_ready)<>59");
    expect(workdayExit).toContain("office_lifecycle_attendance_reminder_sources");
    expect(workdayExit).toContain("office_lifecycle_approved_offboarding_source");
    expect(workdayExit).toContain("'TIME-02'");
    expect(workdayExit).toContain("'EXIT-01'");
    expect(workdayExit).toContain("office_attendance_sessions");
    expect(workdayExit).toContain("office_flex_day_requests");
    expect(workdayExit).toContain("REQUEST_APPROVED");
    for(const code of ["AUTH-10","DEV-08","ONB-08","ONB-03","PAY-11","PAY-12","TIME-07","TIME-09"]){
      expect(controlled).toContain(code);
    }
    expect(controlled).toContain("office_lifecycle_flex_evidence_valid");
    expect(controlled).toContain("office_document_signature_evidence");
    expect(controlled).toContain("office_policy_acknowledgements");
    expect(controlled).not.toContain("SET enabled=true");
    expect(nextSources).toContain("approval.status IN (\'APPROVED\',\'TRUSTED\')");

    expect(forward).toContain("BANK_SALARY_PARTIAL_VERIFIED");
    expect(schema).not.toContain("END IF;\n  ELSIF v_paid");
    expect(forward).not.toContain("END IF;\n  ELSIF v_paid");
    expect(forward).toContain("office_lifecycle_mail_on_recruitment");
    expect(forward).toContain("Existing employee notification ledger requires manual reconciliation");
    expect(forward).not.toContain("SET enabled=true");
    expect(effectiveSchema).toContain("REFERENCE_ID_ISSUED");
    expect(effectiveSchema).toContain("OFFER_SUBMITTED");
    expect(effectiveSchema).toContain("hiring.offer.review");
    expect(effectiveSchema).toContain("office_recruitment_events");
    expect(effectiveSchema).toContain("COMPENSATION_SUBMITTED");
    expect(effectiveSchema).toContain("PAYROLL_SUBMITTED");
    expect(effectiveSchema).toContain("payroll.compensation.review");
    expect(effectiveSchema).toContain("payroll.run.review");
    expect(effectiveSchema).toContain("reference.issued_by");
    expect(effectiveSchema).toContain("office_employee_reference_ids");
    expect(effectiveSchema).toContain("task.status<>'VERIFIED'");
    expect(effectiveSchema).toContain("event_code='PAY-09'");
    expect(worker).toContain('"PAY-09"');
    expect(effectiveSchema).toContain("office_access_audit");
    expect(effectiveSchema).toContain("ROLE_GRANTED");
    expect(effectiveSchema).toContain("ROLE_REVOKED");
    expect(effectiveSchema).toContain("ACCESS_REVIEW_APPROVED");
    expect(effectiveSchema).toContain("PAYROLL_PERIOD_OPENED");
    expect(effectiveSchema).toContain("PAYROLL_APPROVAL_SYNCED");
    expect(effectiveSchema).toContain("SALARY_BATCH_PREPARED");
    expect(effectiveSchema).toContain("bank_execution");
    expect(effectiveSchema).toContain("office_department_ownership");
    expect(effectiveSchema).toContain("office_effective_permission");
    expect(effectiveSchema).toContain("TIME-03");
    expect(effectiveSchema).toContain("office_role_package_onboarding_tasks");
    expect(effectiveSchema).toContain("ONB-02");

    expect(worker).toContain("pay_period");
    expect(effectiveSchema).toContain("FOR UPDATE OF o SKIP LOCKED");
    expect(effectiveSchema).toContain("STALE_UNKNOWN");
    expect(effectiveSchema).toContain("office_lifecycle_mail_policy_history");
    expect(effectiveSchema).toContain("FROM PUBLIC,anon,authenticated,service_role");
    expect(worker).toContain('KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED');
    expect(worker).toContain('PROVIDER_NOT_CONFIGURED');
  });
  it("recognises the four existing first-party credential senders without duplicate lifecycle sends",()=>{
    for(const code of ["AUTH-01","AUTH-05","AUTH-06","AUTH-08"]){
      expect(transactionalAuth).toContain(code);
    }
    for(const sender of ["send_office_invitation_email","send_office_email_verification_code",
      "send_office_device_approval","send_office_password_recovery_email"]){
      expect(existingAuthDelivery).toContain("def "+sender+"(");
      expect(existingAuthRouter).toContain(sender+"(");
    }
    for(const event of ["INVITATION_EMAIL_ACCEPTED","OFFICE_INVITE_EMAIL_OTP_SENT",
      "DEVICE_APPROVAL_SENT","PASSWORD_RECOVERY_EMAIL_ACCEPTED"]){
      expect(transactionalAuth).toContain(event);
    }
    expect(transactionalAuth).toContain("delivery_owner='FIRST_PARTY_AUTH'");
    expect(transactionalAuth).toContain("office_lifecycle_mail_prevent_duplicate_auth_dispatch");
    expect(transactionalAuth).toContain("source_ready)<>63");
    expect(endpoint).toContain('ownership.data.delivery_owner==="FIRST_PARTY_AUTH"');
    expect(controls).toContain("This security email already uses the authenticated KRAVIA Office transactional sender.");
    expect(controls).toContain('active.delivery_owner==="CANDIDATE_WORKER"');
    expect(controls).toContain("Consent-verified candidate mail worker");
    expect(transactionalAuth).not.toContain("INSERT INTO public.office_lifecycle_mail_outbox");
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
