import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180022_engineering_oncall_maintenance.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/engineering-operations-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-engineering-operations/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-engineering-operations.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA engineering on-call and maintenance",()=>{
 it("extends the existing Engineering workspace instead of creating a parallel service registry",()=>{
  expect(requiredCapabilities("office","engineering")).toContain("engineering.oncall.read");
  expect(requiredCapabilities("office","engineering")).toContain("engineering.maintenance.verify");
  expect(screen).toContain("OfficeEngineeringControlCenter");
  expect(screen).toContain("OfficeEngineeringOperations");
  expect(migration).toContain("references public.office_engineering_services");
 });

 it("keeps on-call rotations project-scoped and prevents overlap",()=>{
  expect(migration).toContain("'engineering.oncall.manage','PROJECT',s.project_key");
  expect(migration).toContain("On-call rotation overlaps an existing scheduled rotation");
  expect(migration).toContain("Primary and secondary on-call users must differ");
  expect(server).toContain('"engineering.oncall.manage",service.project_key');
 });

 it("requires infrastructure-change authority before proposing maintenance",()=>{
  expect(migration).toContain("'engineering.maintenance.manage','PROJECT',s.project_key");
  expect(migration).toContain("'engineering.infrastructure.change','PROJECT',s.project_key");
  expect(server).toContain('"engineering.infrastructure.change",service.project_key');
 });

 it("enforces maker-checker approval and independent verification",()=>{
  expect(migration).toContain("Maintenance owner/creator cannot approve their own window");
  expect(migration).toContain("Maintenance owner/creator cannot independently verify their own work");
  expect(migration).toContain("Independent maintenance verification permission is required");
  expect(component).toContain("Independent review");
  expect(component).toContain("Verify completion");
 });

 it("requires rollback and completion evidence",()=>{
  expect(migration).toContain("Rollback evidence is required");
  expect(migration).toContain("Verification evidence and health reference are required");
  expect(component).toContain("Rollback evidence");
  expect(component).toContain("Health reference");
 });

 it("does not claim that scheduling executes provider infrastructure",()=>{
  expect(server).toContain("does not itself execute provider infrastructure changes or deployments");
  expect(route).toContain("officeMutationIsSameOrigin(request)");
 });
});
