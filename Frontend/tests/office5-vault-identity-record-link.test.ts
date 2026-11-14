import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const s=readFileSync(new URL("../app/office/(workspace)/k-vault/[[...segments]]/page.tsx",import.meta.url),"utf8");
describe("K-Vault registration and company identity access",()=>{
 it("allows a source-authorized identity grant to reach its own record detail",()=>{
  expect(s).toContain('visible("registrations")||visible("identity")');
  expect(s).toContain('await requireOfficeVaultRecord({category:"identity",recordId:segments[1],action:"READ"})');
 });
 it("still requires record-level source and active grant on every detail access",()=>{
  expect(s).toContain('requireOfficeVaultRecord({category:"registrations",recordId:segments[1],action:"READ"})');
  expect(s).toContain('getOfficeRegistrationOverview()');
  expect(s).toContain('if(!record) notFound()');
 });
});
