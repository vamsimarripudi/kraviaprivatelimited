import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180041_trigger_function_execute_hardening.sql",import.meta.url),"utf8");

describe("KRAVIA Office trigger-function execute hardening",()=>{
  it("removes browser execution from trigger-only security definer helpers",()=>{
    expect(migration).toContain("revoke execute on function public.office_identity_create_person() from public, anon, authenticated");
    expect(migration).toContain("revoke execute on function public.office_sync_employment_identity() from public, anon, authenticated");
  });

  it("retains trusted service-role execution",()=>{
    expect(migration).toContain("grant execute on function public.office_identity_create_person() to service_role");
    expect(migration).toContain("grant execute on function public.office_sync_employment_identity() to service_role");
  });
});
