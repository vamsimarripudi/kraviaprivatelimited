import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const page=readFileSync(new URL("../app/office/(workspace)/k-vault/[[...segments]]/page.tsx",import.meta.url),"utf8");
describe("K-Vault source-verifiable document chronology",()=>{
 it("requires scoped Vault grant before exposing document source history",()=>{
  const gate=page.indexOf('await requireOfficeVaultRecord({category:"documents"');
  const source=page.indexOf('const records=await getOfficeDocumentStudioOverview()');
  expect(gate).toBeGreaterThan(-1);
  expect(source).toBeGreaterThan(gate);
 });
 it("reads canonical output, signature and delivery evidence without mutating it",()=>{
  expect(page).toContain("records.renders.filter");
  expect(page).toContain("records.signatures.filter");
  expect(page).toContain("records.deliveries.filter");
  expect(page).toContain("sourceTemplateVersion=records.versions.find");
  expect(page).toContain("Evidence chronology");
  expect(page).not.toContain('signOfficeDocument(');
 });
});
