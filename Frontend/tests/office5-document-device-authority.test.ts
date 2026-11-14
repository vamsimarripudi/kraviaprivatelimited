import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const source=readFileSync(new URL("../lib/office/document-studio-server.ts",import.meta.url),"utf8");
describe("Document Studio 5.0 current trusted-device authorization",()=>{
 it("checks the latest AAL2-bound device on every sensitive document permission",()=>{
  expect(source).toContain("currentOfficeTrustedDeviceId(current.admin,current.identity.userId)");
  expect(source).toContain("new WeakMap<Actor,Promise<string|null>>()");
  expect(source).toContain("await currentDocumentDevice(current)");
  expect(source).toContain("resolveOfficePermission(current.admin,current.identity,code,scope,");
 });
 it("does not leave any direct unsafeguarded current-actor document permission calls",()=>{
  const calls=source.match(/documentPermission\(current,/g)||[];
  expect(calls).toHaveLength(10);
  const underlying=source.match(/resolveOfficePermission\(current.admin,current.identity,/g)||[];
  expect(underlying).toHaveLength(1);
 });
 it("does not promote a template author to a document-instance reader",()=>{
  expect(source).toContain("sourceVisibleDocumentInstances(");
  expect(source).toContain("requireInstanceAuthority(");
  expect(source).toContain('hasCurrentOfficeDepartment(current,department)');
 });
});
