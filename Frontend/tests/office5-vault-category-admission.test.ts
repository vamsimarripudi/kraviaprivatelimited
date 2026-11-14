import {describe,it,expect} from "vitest";
import {visibleVaultCategories} from "../lib/office/vault-category-visibility";
import {vaultCategories} from "../lib/office/vault-categories";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../lib/office/vault-server.ts",import.meta.url),"utf8");
describe("K-Vault admission and authorization intersection",()=>{
 it("shows no corporate category solely from inherited read or founder role",()=>{
  const all=new Set(vaultCategories.flatMap(c=>[...c.permissions])
  .filter(code=>code!=="vault.secret.upload"&&code!=="vault.secret.review"));
  expect(visibleVaultCategories(vaultCategories,all,new Set()).length).toBe(0);
 });
 it("shows only actively granted source-authorized categories",()=>{
  const categories=visibleVaultCategories(vaultCategories,
   new Set(["registration.read"]),new Set(["registrations","documents"]));
  expect(categories.map(c=>c.slug)).toEqual(["registrations"]);
 });
 it("prevents a document-template-only permission from claiming record access",()=>{
  expect(visibleVaultCategories(vaultCategories,
   new Set(["document.template.read"]),new Set(["documents"]))).toEqual([]);
  expect(visibleVaultCategories(vaultCategories,
   new Set(["document.instance.read"]),new Set(["documents"])).map(c=>c.slug)).toEqual(["documents"]);
 });
 it("allows upload and independent-review desks without granting unapproved file downloads",()=>{
  expect(visibleVaultCategories(vaultCategories,
   new Set(["vault.secret.upload"]),new Set()).map(c=>c.slug)).toEqual(["secrets"]);
  expect(visibleVaultCategories(vaultCategories,
   new Set(["vault.secret.review"]),new Set()).map(c=>c.slug)).toEqual(["secrets"]);
  expect(visibleVaultCategories(vaultCategories,
   new Set(["vault.secret.read"]),new Set()).map(c=>c.slug)).toEqual([]);
 });
 it("retains category-specific requirements for non-record source links",()=>{
  expect(visibleVaultCategories(vaultCategories,
   new Set(["finance.bank.read"]),new Set(["banking","legal"])).map(c=>c.slug)).toEqual(["banking"]);
 });
 it("requires current, unrevoked and non-expired scoped grant records",()=>{
  expect(source).toContain('eq("grantee_user_id",current.identity.userId)');
  expect(source).toContain('is("revoked_at",null)');
  expect(source).toContain('gt("expires_at",new Date().toISOString())');
  expect(source).toContain('visibleVaultCategories(vaultCategories,new Set(permitted),grantedCategories)');
 });
});
