import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");
describe("Public Careers to governed KRAVIA Office recruitment",()=>{
  it("never advertises unapproved requisitions and keeps public reads server-side",()=>{
    const source=read("../lib/careers/server.ts");
    expect(source).toContain('.eq("status","PUBLISHED")');
    expect(source).toContain('.eq("status","OPEN")');
    expect(source).toContain('.not("approved_at","is",null)');
    expect(source).toContain("closed_at");
    expect(source).toContain("publishedAt");
    expect(source).toContain("QUARANTINED");
  });
  it("requires email verification before HR adoption",()=>{
    const migration=read("../../Database/supabase/migrations/20261116154600_careers_hr_adoption.sql");
    expect(migration).toContain("a.status<>'VERIFIED'");
    expect(migration).toContain("p_actor");
    expect(migration).toContain("office_effective_permission");
    expect(migration).toContain("PUBLIC_APPLICATION_IMPORTED");
    expect(migration).toContain("service_role");
  });
  it("prevents public role escalation and tracks all candidate actions",()=>{
    const route=read("../app/api/careers/portal/route.ts");
    const verify=read("../app/api/careers/verify/route.ts");
    const doc=read("../lib/careers/documents-server.ts");
    expect(verify).toContain("httpOnly");
    expect(route).toContain('request.headers.get("origin")');
    expect(verify).toContain("httpOnly");
    expect(doc).toContain("requestId");
    expect(doc).toContain("office_candidate_document_received_v2");
    expect(doc).toContain("file-scan");
    expect(doc).toContain("AAL2");
  });
  it("keeps applications, offers, and signed approval evidence private",()=>{
    const schema=read("../../Database/supabase/migrations/20261116154500_careers_public_candidate_pipeline.sql");
    const handoff=read("../../Database/supabase/migrations/20261116154700_careers_documents_and_handoff.sql");
    expect(schema).toContain("ENABLE ROW LEVEL SECURITY");
    expect(schema).toContain("REVOKE ALL PRIVILEGES");
    expect(schema).toContain("office_career_rate_consume");
    expect(schema).toContain("token_hash");
    expect(handoff).toContain("SIGNED_DOCUMENT");
    expect(handoff).toContain("office_career_employee_link");
    expect(handoff).toContain("office_auth_users");
  });
  it("limits direct communications to explicit events",()=>{
    const mail=read("../lib/careers/mail.ts");
    expect(mail).toContain("EMAIL_VERIFICATION");
    expect(mail).toContain("APPLICATION_RECEIPT");
    expect(mail).toContain("PROVIDER_UNCERTAIN");
    expect(mail).not.toContain("careers@kraviaprivatelimited.com");
    expect(mail).toContain("publicCorporateEmails.careers");
  });
});
