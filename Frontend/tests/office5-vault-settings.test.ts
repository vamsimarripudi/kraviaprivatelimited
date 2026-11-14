import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const code=readFileSync(new URL("../components/office-vault-settings.tsx",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/office/(workspace)/k-vault/[[...segments]]/page.tsx",import.meta.url),"utf8");
describe("K-Vault governed policy settings",()=>{
 it("resolves current actor, trusted device and independent source policy capabilities",()=>{
  expect(code).toContain("requireOfficeActor()");
  expect(code).toContain("currentOfficeTrustedDeviceId");
  expect(code).toContain('"access.profile.assign"');
  expect(code).toContain("resolveOfficePermission");
 });
 it("does not invent local policy editing or direct grant mutations",()=>{
  expect(code).toContain("getOfficeVaultAccessCenter()");
  expect(code).not.toMatch(/\\.rpc\\(|fetch\\(/);
  expect(page).toContain("<OfficeVaultSettings/>");
 });
});
