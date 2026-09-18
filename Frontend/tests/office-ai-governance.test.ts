import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { financeSections, officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180021_ai_governance.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/ai-governance-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-ai-governance/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-ai-governance.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA AI governance",()=>{
 it("is capability-gated in both Office and Finance",()=>{
  expect(officeSections.ai.title).toBe("AI governance");
  expect(financeSections.ai.title).toBe("AI governance");
  expect(requiredCapabilities("office","ai")).toContain("ai.use.request");
  expect(requiredCapabilities("finance","ai")).toContain("ai.tool.read");
  expect(screen).toContain("OfficeAiGovernance");
 });

 it("does not persist raw prompts or raw model outputs in the governance ledger",()=>{
  expect(migration).not.toMatch(/\braw_prompt\b/i);
  expect(migration).not.toMatch(/\braw_output\b/i);
  expect(migration).toContain("content_sha256");
  expect(migration).toContain("provider_reference");
  expect(migration).toContain("result_reference");
  expect(component).toContain("No model invocation here");
  expect(component).toContain("Do not paste the prompt or model output");
 });

 it("requires independent AI tool and use-case review",()=>{
  expect(migration).toContain("AI tool owner/creator cannot independently review the same tool");
  expect(migration).toContain("Requester cannot approve their own AI use case");
  expect(migration).toContain("Future AI use-case expiry is required");
 });

 it("enforces approved data classifications and prohibited classes",()=>{
  expect(migration).toContain("office_ai_classes_allowed");
  expect(migration).toContain("Requested data classifications exceed the approved tool boundary");
  expect(migration).toContain("Usage data classifications exceed approved use case");
  expect(component).toContain("Allowed data classes");
  expect(component).toContain("Prohibited data classes");
 });

 it("requires human-review evidence for governed action proposals",()=>{
  expect(migration).toContain("Human review reference is required for this action proposal");
  expect(migration).toContain("human_review_required");
  expect(component).toContain("Human review reference");
 });

 it("hides unapproved tool assessments from general users and protects mutations",()=>{
  expect(server).toContain('if(!capabilities.tool_manage&&!capabilities.tool_review)toolsQuery=toolsQuery.eq("status","APPROVED")');
  expect(route).toContain("officeMutationIsSameOrigin(request)");
  expect(server).toContain("does not invoke an AI provider");
 });
});
