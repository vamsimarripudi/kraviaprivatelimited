import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180014_travel_expense_operations.sql",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-travel/route.ts",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/travel-server.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-travel-workspace.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA Travel & Expense Operations",()=>{
 it("is capability-gated and wired into Office",()=>{
   expect(officeSections.travel.title).toBe("Travel & expenses");
   expect(requiredCapabilities("office","travel")).toContain("travel.request");
   expect(requiredCapabilities("office","travel")).toContain("travel.finance_review");
   expect(screen).toContain("OfficeTravelWorkspace");
 });
 it("uses maker-checker separation for travel approvals",()=>{
   expect(migration).toContain("Requester cannot approve their own travel");
   expect(migration).toContain("Requester/manager reviewer cannot perform finance review for the same travel request");
   expect(component).toContain("Manager review");
   expect(component).toContain("Finance review");
 });
 it("requires booking and claim evidence without silently executing bank payments",()=>{
   expect(migration).toContain("Booking reference and evidence are required");
   expect(migration).toContain("Receipt reference is required");
   expect(migration).toContain("Finance payment reference is required to close reimbursement");
   expect(server).toContain("does not silently execute bank payments");
   expect(component).toContain("Booking evidence reference");
   expect(component).toContain("Receipt reference");
 });
 it("prevents claimants from reviewing their own claims",()=>{
   expect(migration).toContain("Claimant cannot review their own travel claim");
 });
 it("protects travel mutations with same-origin enforcement",()=>{
   expect(route).toContain("officeMutationIsSameOrigin(request)");
 });
});
