import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const view=readFileSync(new URL("../components/office-connect-integrations.tsx",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/office/(workspace)/chat/[...segments]/page.tsx",import.meta.url),"utf8");
const lifecycle=readFileSync(new URL("../app/api/office-lifecycle-mail-policy/route.ts",import.meta.url),"utf8");
const employee=readFileSync(new URL("../app/api/office-employee-mail-policy/route.ts",import.meta.url),"utf8");
describe("Connect integrations are source-bound and non-sending",()=>{
 it("renders the dedicated administration route and reads the two authoritative policy ledgers",()=>{
  expect(route).toContain('if(path==="admin/integrations")return <OfficeConnectIntegrations/>;');
  expect(view).toContain('"/api/office-lifecycle-mail-policy"');
  expect(view).toContain('"/api/office-employee-mail-policy"');
  expect(view).toContain('method:"POST"').toBe(false);
 });
 it("leaves mail controls under the existing AAL2 Owner authority",()=>{
  expect(lifecycle).toContain('result.identity.roles.includes("OWNER")');
  expect(employee).toContain('actor.identity.roles.includes("OWNER")');
  expect(view).toContain('Current corporate mail-policy access is not assigned');
  expect(view).toContain('Provider acceptance is not inbox delivery');
 });
 it("does not display false zero counts when a provider source is denied or unavailable",()=>{
  expect(view).toContain(':"Unknown"');
  expect(view).toContain('status:"unavailable"');
  expect(view).toContain('status:"denied"');
 });
});
