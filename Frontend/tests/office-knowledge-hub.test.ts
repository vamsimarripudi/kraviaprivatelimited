import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180017_policy_announcements_knowledge.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/knowledge-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-knowledge/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-knowledge-hub.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA Policy, Announcements and Knowledge Hub",()=>{
 it("is audience and capability gated",()=>{
  expect(officeSections.knowledge.title).toBe("Policy & knowledge");
  expect(requiredCapabilities("office","knowledge")).toContain("policy.read");
  expect(requiredCapabilities("office","knowledge")).toContain("knowledge.read");
  expect(screen).toContain("OfficeKnowledgeHub");
  expect(server).toContain("inAudience");
 });

 it("publishes immutable policy versions through maker-checker review",()=>{
  expect(migration).toContain("Policy version creator cannot independently publish the same version");
  expect(migration).toContain("content_sha256");
  expect(migration).toContain("SUPERSEDED");
  expect(component).toContain("New version");
 });

 it("records policy acknowledgement without inferring comprehension",()=>{
  expect(route).toContain("ACK_POLICY");
  expect(migration).toContain("office_policy_acknowledgements");
  expect(server).toContain("does not infer comprehension or legal consent");
 });

 it("supports audience-scoped announcements with read and acknowledgement receipts",()=>{
  expect(migration).toContain("office_announcement_receipts");
  expect(route).toContain("ANNOUNCEMENT_RECEIPT");
  expect(component).toContain("Mark read");
  expect(component).toContain("Acknowledge");
 });

 it("versions internal SOPs and runbooks and prohibits self-publishing",()=>{
  expect(migration).toContain("office_knowledge_versions");
  expect(migration).toContain("Knowledge version creator cannot independently publish the same version");
  expect(component).toContain("RUNBOOK");
  expect(component).toContain("ARCHITECTURE");
 });

 it("protects browser mutations with same-origin enforcement",()=>{
  expect(route).toContain("officeMutationIsSameOrigin(request)");
 });
});
