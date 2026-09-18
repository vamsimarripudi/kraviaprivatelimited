import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { financeSections, officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180016_resilience_continuity_insurance.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/resilience-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-resilience/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-resilience.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA resilience, continuity and insurance controls",()=>{
 it("wires capability-scoped resilience into Office and insurance into Finance",()=>{
  expect(officeSections.resilience.title).toBe("Resilience & continuity");
  expect(financeSections.insurance.title).toBe("Insurance");
  expect(requiredCapabilities("office","resilience")).toContain("resilience.incident.report");
  expect(requiredCapabilities("office","resilience")).toContain("resilience.plan.review");
  expect(requiredCapabilities("finance","insurance")).toContain("insurance.read");
  expect(screen).toContain("OfficeResilienceWorkspace");
  expect(screen).toContain('mode="insurance"');
 });

 it("keeps continuity plans under independent review",()=>{
  expect(migration).toContain("Plan owner/creator cannot independently review the same plan");
  expect(migration).toContain("Independent plan-review permission is required");
  expect(component).toContain("Advance / review");
 });

 it("requires independent evidence-backed resilience-test verification",()=>{
  expect(migration).toContain("Test owner/creator cannot independently verify the same test");
  expect(migration).toContain("Verification evidence is required");
  expect(route).toContain("TRANSITION_TEST");
  expect(component).toContain("Update / verify");
 });

 it("allows employees to report emergencies while reserving incident management",()=>{
  expect(migration).toContain("resilience.incident.report");
  expect(migration).toContain("resilience.incident.manage");
  expect(route).toContain("REPORT_INCIDENT");
  expect(route).toContain("TRANSITION_INCIDENT");
  expect(server).toContain("resilience.incident.report");
 });

 it("does not let insurance claim owner/reporters independently review their own claim",()=>{
  expect(migration).toContain("Claim owner/reporter cannot independently review the same claim");
  expect(migration).toContain("Insurer payment reference is required");
  expect(component).toContain("Payment reference");
 });

 it("protects browser mutations and avoids fabricated payment/recovery claims",()=>{
  expect(route).toContain("officeMutationIsSameOrigin(request)");
  expect(server).toContain("does not certify regulatory compliance, insurer acceptance, recovery success, or actual claim payment");
 });
});
