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
 it("keeps the Manohar-style multi-role Office entry without granting HR or Finance actions",()=>{
  const roles=["DIRECTOR","FINANCE","HR","MEMBER","PRODUCT_ADMIN"] as const;
  expect(capabilityCanAccessSection("office","dashboard",roles,[])).toBe(true);
  expect(capabilityCanAccessSection("finance","payments",roles,[])).toBe(false);
  expect(capabilityCanAccessSection("office","people",roles,[])).toBe(false);
 });
});
