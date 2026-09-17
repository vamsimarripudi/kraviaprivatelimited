import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const identitySql = readFileSync(new URL("../../Backend/spec/identity/SUPABASE_PERMANENT_IDENTITY.sql", import.meta.url), "utf8");
const identityServer = readFileSync(new URL("../lib/office/company-identity-server.ts", import.meta.url), "utf8");
const sessionRoute = readFileSync(new URL("../app/api/office-auth/session/route.ts", import.meta.url), "utf8");
const workforceServer = readFileSync(new URL("../lib/office/workforce-overview-server.ts", import.meta.url), "utf8");
const workforceUi = readFileSync(new URL("../components/workforce-live-overview.tsx", import.meta.url), "utf8");

describe("KRAVIA permanent company identities", () => {
  it("generates stable human-readable Person and Employment IDs", () => {
    expect(identitySql).toContain("KR-P-");
    expect(identitySql).toContain("KR-E-");
    expect(identitySql).toContain("office_person_code_seq");
    expect(identitySql).toContain("office_employment_code_seq");
    expect(identitySql).toContain("office_person_code_format");
    expect(identitySql).toContain("office_employment_code_format");
  });

  it("never deletes permanent identity history on exit", () => {
    expect(identitySql).toContain("KRAVIA permanent identity records cannot be deleted");
    expect(identitySql).toContain("KRAVIA Person ID is immutable");
    expect(identitySql).toContain("KRAVIA Employment ID is immutable");
    expect(identitySql).toContain("status='ENDED'");
    expect(identitySql).toContain("on delete restrict");
  });

  it("automatically provisions a Person ID and syncs employment from governed job assignments", () => {
    expect(identitySql).toContain("office_identity_create_person_guard");
    expect(identitySql).toContain("office_job_sync_employment_identity");
    expect(identitySql).toContain("office_ensure_person_identity");
    expect(identitySql).toContain("office_current_company_identity");
  });

  it("resolves the permanent identity only through the trusted server authority", () => {
    expect(identityServer).toContain("createOfficeServiceClient");
    expect(identityServer).toContain("office_current_company_identity");
    expect(identitySql).toContain("revoke all on public.office_people_registry,public.office_employment_registry from anon,authenticated,public");
    expect(identitySql).toContain("grant execute on function public.office_current_company_identity(uuid) to service_role");
  });

  it("carries company IDs into session metadata and the live workforce view", () => {
    expect(sessionRoute).toContain("company_identity: companyIdentity");
    expect(workforceServer).toContain("person_code");
    expect(workforceServer).toContain("employment_code");
    expect(workforceUi).toContain("person.person_code");
    expect(workforceUi).toContain("person.employment_code");
  });
});
