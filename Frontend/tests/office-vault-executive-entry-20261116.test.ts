import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const gate=read("lib/office/vault-entry-server.ts");
const index=read("lib/office/vault-server.ts");
const record=read("lib/office/vault-access-server.ts");
const secret=read("lib/office/vault-secret-server.ts");
const verify=read("lib/office/vault-verification-server.ts");
const shell=read("components/office-workspace-shell.tsx");
const page=read("app/office/(workspace)/k-vault/[[...segments]]/page.tsx");
const preview=read("app/api/office-vault/documents/[id]/preview/route.ts");
const download=read("app/api/office-vault/documents/[id]/download/route.ts");
const sql=read("../Database/supabase/migrations/20261115201318_office_vault_founder_ceo_entry.sql");
describe("K-Vault Founder/Executive and CEO-only entry",()=>{
 it("registers a non-bypassable, audited entry entitlement for two appointed identities",()=>{
  expect(sql).toContain("'vault.entry','VAULT','ENTER'");
  expect(sql).toContain("'SENSITIVE',false,false,true,false");
  expect(sql).toContain("founder_count<>1 or ceo_count<>1");
  expect(sql).toContain("position_code='OWNER_FOUNDER'");
  expect(sql).toContain("i.job_title='CEO & CFO'");
  expect(sql).toContain("office_set_permission_override");
  expect(sql).toContain("'vault.secret.read','ALLOW'");
  expect(sql).not.toContain("'vault.secret.upload','ALLOW'");
  expect(sql).not.toContain("'vault.secret.review','ALLOW'");
  expect(sql).not.toContain("'vault.secret.download','ALLOW'");
  expect(sql).not.toContain("office_vault_access_grants(");
 });
 it("checks the source-authorized permission rather than job title or broad OWNER status",()=>{
  expect(gate).toContain('resolveOfficePermission(actor.admin,actor.identity,');
  expect(gate).toContain('"vault.entry",{type:"COMPANY"},null');
  expect(gate).toContain('if(!verdict.allowed)');
  expect(gate).toContain('actor.identity.workspaceStatus!=="ACTIVE"');
  expect(shell).toContain('permissions.includes("vault.entry")');
  expect(shell).not.toContain('"custody.read", "document.instance.read", "document.template.read",');
 });
 it("denies direct Vault pages, API grants, secret operations and raw document downloads",()=>{
  expect(index).toContain('await requireOfficeVaultEntry(current)');
  expect(record).toContain('await requireOfficeVaultEntry(current)');
  expect(secret).toContain('await requireOfficeVaultEntry(current)');
  expect(verify).toContain('await requireOfficeVaultEntry()');
  expect(page).toContain('await requireOfficeVaultEntry()');
  expect(page).toContain('error.status===403)notFound()');
  for(const route of [preview,download]){
   expect(route).toContain('await requireOfficeVaultEntry(current)');
   expect(route.indexOf('await requireOfficeVaultEntry(current)'))
    .toBeLessThan(route.indexOf('from("office_document_renders")'));
  }
 });
 it("preserves separate company-managed device, per-document grant, independent review and audit",()=>{
  expect(secret).toContain('linked.data.company_managed!==true');
  expect(secret).toContain('version.scan_state!=="CLEAN"||version.review_state!=="APPROVED"');
  expect(record).toContain('"office_vault_access_grants"');
  expect(record).toContain('"office_vault_access_events"');
 });
});
