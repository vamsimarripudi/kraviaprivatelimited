import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const page=readFileSync(new URL("../app/office/(workspace)/k-vault/[[...segments]]/page.tsx",import.meta.url),"utf8");
describe("K-Vault registration evidence field minimization",()=>{
 it("only exposes a linked evidence state to a Vault READ grant",()=>{
  expect(page).toContain('requireOfficeVaultRecord({category:"registrations",recordId:segments[1],action:"READ"})');
  expect(page).toContain('record.evidence_reference ? "Recorded in the authoritative registry"');
  expect(page).not.toContain('>{record.evidence_reference || "Not linked"}');
 });
 it("links to the actual independently authorized registry instead of copying evidence",()=>{
  expect(page).toContain('href="/office/registrations"');
  expect(page).toContain("getOfficeRegistrationOverview()");
 });
});
