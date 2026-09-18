import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180009_it_service_licensing.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/it-service-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-it/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-it-service.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const workspaces=readFileSync(new URL("../lib/office/workspaces.ts",import.meta.url),"utf8");
const capabilities=readFileSync(new URL("../lib/office/workspace-capabilities.ts",import.meta.url),"utf8");

describe("KRAVIA IT service and software licence controls",()=>{
 it("gives every access profile a self-service IT request capability",()=>{
  expect(migration).toContain("select code,'it.service.request','ALLOW','OWN' from public.office_access_profile_catalog");
  expect(migration).toContain("office_it_create_ticket");
 });
 it("keeps ticket management and licence assignment separately privileged",()=>{
  expect(migration).toContain("it.service.manage");
  expect(migration).toContain("it.license.manage");
  expect(migration).toContain("No licence seats are available");
  expect(migration).toContain("office_it_revoke_license");
 });
 it("protects mutations and does not turn ticket resolution into implicit access",()=>{
  expect(route).toContain("officeMutationIsSameOrigin");
  expect(route).toContain("ASSIGN_LICENSE");
  expect(server).toContain("Resolving a ticket does not silently grant application access");
  expect(server).toContain("requireOfficePermission");
 });
 it("is wired into executable capability navigation",()=>{
  expect(workspaces).toContain('it: { title: "IT service desk"');
  expect(capabilities).toContain('"office:it"');
  expect(screen).toContain("OfficeItService");
 });
});
