import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const path=new URL("../lib/office/vault-server.ts",import.meta.url);
const source=readFileSync(path,"utf8");
describe("Office 5.0 Vault category authority uses managed-device policy",()=>{
 it("checks both company and own scope using current trusted device",()=>{
  expect(source).toContain("currentOfficeTrustedDeviceId(current.admin,current.identity.userId)");
  expect(source).toContain('resolveOfficePermission(current.admin,current.identity,code,{type:"COMPANY"},deviceId)');
  expect(source).toContain('resolveOfficePermission(current.admin,current.identity,code,{type:"OWN",ownerUserId:current.identity.userId},deviceId)');
 });
 it("never displays categories for non-active workspace identities",()=>{
  expect(source).toContain('current.identity.workspaceStatus!=="ACTIVE"');
  expect(source).toContain('vaultCategories.filter(row=>row.permissions.some(code=>permitted.includes(code)))');
 });
});
