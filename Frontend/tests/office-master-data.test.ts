import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { financeSections, officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const permissions=readFileSync(new URL("../../Database/supabase/migrations/202609180038_master_data_permissions.sql",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-master-data.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const gateway=readFileSync(new URL("../app/api/office-runtime/[...path]/route.ts",import.meta.url),"utf8");
const backend=readFileSync(new URL("../../Backend/backend/main.py",import.meta.url),"utf8");
const schemas=readFileSync(new URL("../../Backend/backend/schemas.py",import.meta.url),"utf8");

describe("KRAVIA canonical product/customer master data",()=>{
 it("uses capability-led navigation rather than broad role titles",()=>{
  expect(officeSections.products.roles).toContain("MEMBER");
  expect(officeSections.customers.roles).toContain("MEMBER");
  expect(financeSections.customers.title).toBe("Customer master");
  expect(requiredCapabilities("office","products")).toContain("master.product.read");
  expect(requiredCapabilities("office","customers")).toContain("master.customer.read");
  expect(requiredCapabilities("finance","customers")).toContain("master.customer.create");
 });

 it("keeps product create authority stricter than product read",()=>{
  expect(permissions).toContain("'master.product.create'");
  expect(permissions).toContain("Product creation is intentionally not assigned to a normal profile");
  expect(backend).toContain('ctx=Depends(require_roles("OWNER"))');
  expect(screen).toContain('identity.roles.includes("OWNER") || permissions.includes("master.product.create")');
 });

 it("creates customers only through the canonical FastAPI runtime",()=>{
  expect(component).toContain('request(kind,{method:"POST"');
  expect(component).toContain('"Idempotency-Key":idempotencyKey()');
  expect(backend).toContain('@app.post("/api/v1/customers"');
  expect(backend).toContain('require_roles("OWNER","FINANCE")');
  expect(schemas).toContain('class CustomerCreate');
  expect(schemas).toContain('GSTIN must be 15 alphanumeric characters');
 });

 it("uses the fixed same-origin runtime gateway rather than direct backend browser access",()=>{
  expect(gateway).toContain('"products"');
  expect(gateway).toContain('"customers"');
  expect(gateway).toContain("officeMutationIsSameOrigin(request)");
  expect(gateway).toContain('"idempotency-key"');
  expect(gateway).toContain('headers.set("Authorization"');
  expect(component).toContain('/api/office-runtime/');
 });

 it("wires Products and Customers to the specialised action surface",()=>{
  expect(screen).toContain('<OfficeMasterData kind="products"');
  expect(screen).toContain('<OfficeMasterData kind="customers"');
 });
});
