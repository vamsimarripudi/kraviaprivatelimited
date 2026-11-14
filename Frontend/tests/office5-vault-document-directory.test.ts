import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const route=readFileSync(new URL("../app/office/(workspace)/k-vault/[[...segments]]/page.tsx",import.meta.url),"utf8");
const directory=readFileSync(new URL("../components/office-vault-document-directory.tsx",import.meta.url),"utf8");
describe("K-Vault document directory remains source-permission scoped",()=>{
 it("filters by both current Vault grant and canonical source before client projection",()=>{
  expect(route).toContain('getOfficeVaultGrantedResources("documents")');
  expect(route).toContain('getOfficeVaultSourceVisibleRecordIds("documents",data.instances)');
  expect(route).toContain('grants.includes(null)||grants.includes(row.id)');
  expect(route).toContain('return <OfficeVaultDocumentDirectory records={rows}/>');
 });
 it("does not expose storage keys, full identity data or unapproved file URLs",()=>{
  expect(directory).not.toContain("storage_reference");
  expect(directory).not.toContain("createSignedUrl");
  expect(directory).not.toContain("owner_user_id");
  expect(directory).toContain('Source outputs');
  expect(directory).toContain("not proof");
 });
 it("keeps sensitive actions in Document Studio and protected file routes",()=>{
  expect(directory).toContain('href="/office/documents"');
  expect(directory).toContain('href={"/office/k-vault/documents/"+doc.id}');
  expect(directory).not.toContain("method:\"POST\"");
 });
});
