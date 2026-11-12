import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const issuance = readFileSync(
  new URL("../../Database/supabase/migrations/202611120003_verified_employee_intake_and_ids.sql", import.meta.url),
  "utf8",
);
const hardening = readFileSync(
  new URL("../../Database/supabase/migrations/202611120004_immutable_employee_reference_ids.sql", import.meta.url),
  "utf8",
);

describe("KRAVIA immutable employee reference issuance", () => {
  it("retains the unique canonical employee mapping and the independently gated issuer", () => {
    expect(issuance).toContain("employee_user_id uuid primary key");
    expect(issuance).toContain("employment_id uuid not null unique");
    expect(issuance).toContain("reference_code text not null unique");
    expect(issuance).toContain("p_actor=p_employee");
    expect(issuance).toContain("task_code='APPOINTMENT_SIGNED'");
    expect(issuance).toContain("bank_verified_at is null");
    expect(issuance).toContain("public.office_employee_reference_issue");
  });

  it("removes direct service-role writes while retaining read access", () => {
    expect(hardening).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE[\s\S]*?FROM public, anon, authenticated, service_role;/);
    expect(hardening).toContain("GRANT SELECT ON TABLE public.office_employee_reference_ids TO service_role");
    expect(hardening).toContain("pg_catalog.has_table_privilege");
    expect(hardening).toContain("Employee ID issuance privilege boundary is not enforced");
  });

  it("installs a guarded, non-bypassable-by-default write-once database trigger", () => {
    expect(hardening).toContain("SECURITY INVOKER");
    expect(hardening).toContain("SET search_path = ''");
    expect(hardening).toContain("BEFORE UPDATE OR DELETE ON public.office_employee_reference_ids");
    expect(hardening).toContain("FOR EACH ROW");
    expect(hardening).toContain("Issued employee reference IDs cannot be changed or deleted");
    expect(hardening).toContain("Employee ID immutability trigger was not installed");
  });

  it("does not rewrite employment UUIDs, issue sample IDs or send mail on migration", () => {
    expect(hardening).not.toMatch(/UPDATE\s+public\.office_employment_registry\s+SET/i);
    expect(hardening).not.toMatch(/INSERT\s+INTO\s+public\.office_employee_reference_ids/i);
    expect(hardening).not.toMatch(/INSERT\s+INTO\s+public\.office_employee_mail_outbox/i);
  });
});
