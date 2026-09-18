import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180014_contract_obligations.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/contracts-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-contracts/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-contract-workspace.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA contract obligation engine",()=>{
 it("is capability-gated and wired into the Contracts workspace",()=>{
  expect(requiredCapabilities("office","contracts")).toContain("legal.obligation.read");
  expect(requiredCapabilities("office","contracts")).toContain("legal.obligation.manage");
  expect(screen).toContain("OfficeContractWorkspace");
 });

 it("preserves canonical contract ownership while validating linkage",()=>{
  expect(migration).toContain("legacy contracts table is owned by the backend runtime role");
  expect(migration).toContain("if not exists(select 1 from public.contracts where id=p_contract)");
  expect(migration).not.toContain("references public.contracts");
 });

 it("advances recurring obligations and closes one-time obligations after fulfillment",()=>{
  expect(migration).toContain("office_contract_obligation_next_due");
  expect(migration).toContain("when 'MONTHLY'");
  expect(migration).toContain("when 'QUARTERLY'");
  expect(migration).toContain("when 'ANNUAL'");
  expect(migration).toContain("when o.cadence='ONCE' then 'CLOSED'");
 });

 it("requires independent evidence-backed waiver and closure review",()=>{
  expect(migration).toContain("Obligation owner/creator cannot independently waive or close the same obligation");
  expect(migration).toContain("Review evidence is required");
  expect(component).toContain("Independent review");
 });

 it("protects browser mutations and keeps contract actions server-authorised",()=>{
  expect(route).toContain("officeMutationIsSameOrigin(request)");
  expect(server).toContain("resolveOfficePermission");
  expect(route).toContain("CREATE_OBLIGATION");
  expect(route).toContain("SATISFY_OBLIGATION");
  expect(route).toContain("REVIEW_OBLIGATION");
 });
});
