import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180040_company_registration_registry.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/registration-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-registrations/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-registration-registry.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const capabilities=readFileSync(new URL("../lib/office/workspace-capabilities.ts",import.meta.url),"utf8");

describe("KRAVIA company registration registry",()=>{
 it("replaces the dead generic registrations route with a controlled workspace",()=>{
  expect(screen).toContain("OfficeRegistrationRegistry");
  expect(screen).toContain('section === "registrations" ? <OfficeRegistrationRegistry');
  expect(component).toContain('/api/office-registrations');
  expect(capabilities).not.toContain('"office:registrations"');
 });
 it("stores only masked identifier suffixes",()=>{
  expect(server).toContain('return "••••"+suffix');
  expect(component).toContain("Identifier suffix only");
  expect(component).toContain("do not paste the full private identifier");
  expect(migration).toContain("identifier_masked text not null");
 });
 it("creates registrations as unverified and requires independent verification",()=>{
  expect(migration).toContain("status text not null default 'UNVERIFIED'");
  expect(migration).toContain("Registration creator cannot independently verify the same record");
  expect(server).toContain("Registration creator cannot independently review the same record");
  expect(component).toContain("Creation is always UNVERIFIED");
 });
 it("keeps tables private to the service role and mutations same-origin",()=>{
  expect(migration).toContain("enable row level security");
  expect(migration).toContain("revoke all on public.office_company_registrations,public.office_registration_events from public,anon,authenticated");
  expect(route).toContain("officeMutationIsSameOrigin(request)");
 });
 it("records registration lifecycle evidence without coupling to the legacy FastAPI audit table",()=>{
  expect(migration).toContain("office_registration_events");
  expect(migration).toContain("'REGISTRATION_REVIEWED'");
  expect(migration).toContain("'REGISTRATION_UPDATED'");
  expect(server).not.toContain('from("audit_events")');
 });
});
