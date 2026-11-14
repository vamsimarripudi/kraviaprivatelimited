import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {capabilityCanAccessSection} from "../lib/office/workspace-capabilities";
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
describe("Office 5.0 effective action entitlements",()=>{
 it("does not enable Finance payment actions because of a job title",()=>{
  expect(screen).toContain('canStage={!financeReadOnly && permissions.includes("finance.payment.prepare")}');
  expect(screen).toContain('canDecide={!financeReadOnly && permissions.includes("finance.payment.approve")}');
  expect(screen).toContain('canExecute={!financeReadOnly && permissions.includes("finance.payment.approve")}');
 });
 it("requires current create capability for products, customers and invoices",()=>{
  for(const code of ["master.product.create","master.customer.create","finance.invoice.create","finance.receipt.record"]){
   expect(screen).toContain('permissions.includes("'+code+'")');
  }
  expect(screen).not.toContain('identity.roles.includes("OWNER") || permissions.includes("finance.invoice.create")');
 });
 it("keeps OWNER's non-bypass permissions behind explicit grants and effective denies",()=>{
  const cap=readFileSync(new URL("../lib/office/capability-server.ts",import.meta.url),"utf8");
  expect(cap).toContain('.select("code,active,owner_bypass,high_risk,requires_managed_device")');
  expect(cap).toContain("entry.owner_bypass===false");
  expect(cap).toContain("currentOfficeTrustedDeviceId(admin,identity.userId)");
  expect(cap).toContain("managedDeviceValid");
  expect(cap).not.toContain("const permissions = Array.from(activeCodes).sort()");
  expect(cap).toContain("officeAccessProfileIsEffective(row)");
 });
 it("keeps the Manohar-style multi-role Office entry without granting HR or Finance actions",()=>{
  const roles=["DIRECTOR","FINANCE","HR","MEMBER","PRODUCT_ADMIN"] as const;
  expect(capabilityCanAccessSection("office","dashboard",roles,[])).toBe(true);
  expect(capabilityCanAccessSection("finance","payments",roles,[])).toBe(false);
  expect(capabilityCanAccessSection("office","people",roles,[])).toBe(false);
 });
});
