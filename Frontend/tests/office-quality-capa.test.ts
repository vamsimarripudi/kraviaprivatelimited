import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180028_quality_capa.sql",import.meta.url),"utf8");
const selfRead=readFileSync(new URL("../../Database/supabase/migrations/202609180029_quality_self_service_read.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/quality-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-quality/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-quality.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA Quality and CAPA",()=>{
 it("is capability-gated and wired into Office",()=>{
  expect(officeSections.quality.title).toBe("Quality & CAPA");
  expect(requiredCapabilities("office","quality")).toContain("quality.nonconformance.report");
  expect(requiredCapabilities("office","quality")).toContain("quality.capa.review");
  expect(screen).toContain("OfficeQualityWorkspace");
 });

 it("keeps process revisions immutable and maker-checker published",()=>{
  expect(migration).toContain("office_quality_process_versions");
  expect(migration).toContain("content_sha256");
  expect(migration).toContain("Process version creator cannot independently publish the same revision");
  expect(component).toContain("Publish revision");
 });

 it("supports self-service reporting without exposing department-wide quality records",()=>{
  expect(selfRead).toContain("'quality.read','ALLOW','OWN'");
  expect(server).toContain('.or("reporter_user_id.eq."+current.identity.userId+",owner_user_id.eq."+current.identity.userId)');
  expect(route).toContain("REPORT_NC");
  expect(component).toContain("Report nonconformance");
 });

 it("requires independent nonconformance closure and CAPA effectiveness review",()=>{
  expect(migration).toContain("Reporter/owner cannot independently close the same nonconformance");
  expect(migration).toContain("CAPA owner/creator cannot independently verify the same CAPA");
  expect(migration).toContain("CAPA effectiveness evidence is required");
  expect(component).toContain("Independent closure");
  expect(component).toContain("Advance / verify");
 });

 it("blocks project-quality scoring from passive employee telemetry",()=>{
  expect(migration).toContain("No passive telemetry or employee activity is converted into a quality score");
  expect(server).toContain("does not calculate employee or quality scores from login duration, commits, activity telemetry or task counts");
  expect(component).toContain("evidence, root cause and independent verification");
 });

 it("protects mutations with same-origin and server authorization",()=>{
  expect(route).toContain("officeMutationIsSameOrigin(request)");
  expect(server).toContain("resolveOfficePermission");
 });
});
