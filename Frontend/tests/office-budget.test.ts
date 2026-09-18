import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { financeSections, officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180035_budget_control.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/budget-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-budget/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-budget.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA governed budget control",()=>{
 it("is available to scoped Office managers and full Finance authority",()=>{
  expect(officeSections.budget.title).toBe("Budgets");
  expect(financeSections.budget.title).toBe("Budgets");
  expect(requiredCapabilities("office","budget")).toContain("finance.budget.read");
  expect(requiredCapabilities("office","budget")).toContain("finance.budget.commit");
  expect(requiredCapabilities("finance","budget")).toContain("finance.budget.actual");
  expect(screen).toContain("OfficeBudgetWorkspace");
 });

 it("uses maker-checker review for cycles, allocations and adjustments",()=>{
  expect(migration).toContain("Budget-cycle creator cannot independently review the same cycle");
  expect(migration).toContain("Budget creator cannot independently review the same allocation");
  expect(migration).toContain("Adjustment requester cannot approve their own budget change");
  expect(component).toContain("Review / advance");
 });

 it("does not silently edit approved allocations",()=>{
  expect(migration).toContain("office_budget_adjustments");
  expect(migration).toContain("delta_minor");
  expect(migration).toContain("BUDGET_ADJUSTMENT_REQUESTED");
  expect(component).toContain("Request adjustment");
 });

 it("prevents commitments and actuals from exceeding budget capacity",()=>{
  expect(migration).toContain("Insufficient available budget");
  expect(migration).toContain("Actual spend exceeds available budget capacity");
  expect(migration).toContain("Adjustment would reduce budget below committed/actual spend");
  expect(server).toContain("office_budget_available");
 });

 it("converts a commitment to actual only with evidence",()=>{
  expect(migration).toContain("Actual-spend evidence is required");
  expect(migration).toContain("status='CONVERTED'");
  expect(component).toContain("Convert to actual");
  expect(component).toContain("Evidence reference");
 });

 it("does not claim to execute a bank payment",()=>{
  expect(server).toContain("does not execute a bank payment");
  expect(component).toContain("Recording an actual does not execute a payment");
  expect(route).toContain("officeMutationIsSameOrigin(request)");
 });
});
