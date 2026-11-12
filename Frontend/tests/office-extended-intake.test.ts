import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(new URL("../app/api/office-employee-intake/route.ts", import.meta.url),"utf8");
const server = readFileSync(new URL("../lib/office/employee-intake-server.ts", import.meta.url),"utf8");
const form = readFileSync(new URL("../components/office-employee-intake.tsx", import.meta.url),"utf8");
const profile = readFileSync(new URL("../components/office-employee-summary.tsx", import.meta.url),"utf8");
const migration = readFileSync(new URL("../../Database/supabase/migrations/202611130001_extended_employee_intake.sql", import.meta.url),"utf8");

describe("KRAVIA extended employee onboarding",()=>{
  it("preserves only service-role access to private supplementary evidence",()=>{
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("from public,anon,authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("emergency_contacts jsonb");
    expect(migration).toContain("prior_experience jsonb");
    expect(migration).toContain("tax_declarations jsonb");
    expect(migration).toContain("jsonb_array_length(emergency_contacts)<=4");
    expect(migration).toContain("jsonb_array_length(prior_experience)<=15");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+public\.office_employee_intake_profiles/i);
  });
  it("strictly validates extended onboarding fields and limits volume",()=>{
    for(const field of ["specialisation","start_date","completion_date","emergency_contacts","prior_experience","tax_declarations"]){
      expect(route).toContain(field);
      expect(server).toContain(field);
    }
    expect(route).toContain(".strict()).max(4)");
    expect(route).toContain(".strict()).max(15)");
    expect(route).toContain('regime_preference: z.enum(["OLD","NEW","UNDECLARED"])');
    expect(server).toContain("employeeIntakeOverview");
    expect(server).toContain('await reviewer(current,id,"people.update")');
    expect(server).toContain('bank_account_last4');
  });
  it("supports private saved edits and complete independent HR review",()=>{
    expect(form).toContain("Emergency contacts · private");
    expect(form).toContain("Prior employment and experience");
    expect(form).toContain("Specialisation");
    expect(form).toContain("Complete private employee intake review");
    expect(form).toContain("Bank account:");
    expect(form).toContain(" (masked)");
    expect(form).not.toContain("bank_account_ciphertext");
    expect(server).toContain('bank_account_ciphertext:encrypted');
  });
  it("does not present a pending uploaded photo as an approved employee identity",()=>{
    expect(profile).toContain('intake?.profile?.status === "VERIFIED"');
    expect(form).toContain("Scanned privately; subject to HR review");
    expect(form).toContain("reviewed");
  });
});
