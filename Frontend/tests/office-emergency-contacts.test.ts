import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { financeSections, officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180033_emergency_contacts.sql",import.meta.url),"utf8");
const permissionEngine=readFileSync(new URL("../lib/office/permission-engine.ts",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/emergency-contacts-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-emergency-contacts/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-emergency-contacts.tsx",import.meta.url),"utf8");
const search=readFileSync(new URL("../lib/office/search-server.ts",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA private emergency contacts",()=>{
 it("is available for own self-service in Office and Finance",()=>{
  expect(officeSections.emergency.title).toBe("Emergency contacts");
  expect(financeSections.emergency.title).toBe("Emergency contacts");
  expect(requiredCapabilities("office","emergency")).toContain("people.emergency_contact.own");
  expect(requiredCapabilities("finance","emergency")).toContain("people.emergency_contact.own");
  expect(screen).toContain("OfficeEmergencyContacts");
 });

 it("uses non-bypass restricted HR/safety read authority",()=>{
  expect(migration).toContain("'people.emergency_contact.read'");
  expect(migration).toContain("owner_bypass");
  expect(migration).toContain("OWNER/executive status does not bypass this permission");
  expect(permissionEngine).toContain('permissionResult.data.owner_bypass !== false');
 });

 it("allows only employees to maintain their own contacts and deactivates instead of deleting",()=>{
  expect(migration).toContain("'people.emergency_contact.own','ALLOW','OWN'");
  expect(migration).toContain("c.user_id<>p_actor");
  expect(migration).toContain("set active=false");
  expect(migration).not.toMatch(/delete\s+from\s+public\.office_emergency_contacts/i);
 });

 it("requires E.164 phone and explicit employee attestation",()=>{
  expect(migration).toContain("Employee attestation is required");
  expect(migration).toContain("Emergency-contact phone must use E.164 format");
  expect(component).toContain("you attest this contact is current");
 });

 it("redacts safety contact details until explicit audited reveal",()=>{
  expect(server).toContain("restricted_contact:true");
  expect(server).toContain('event_type:"VIEWED_BY_SAFETY"');
  expect(component).toContain("Reveal for safety use");
  expect(component).toContain("This reveal was recorded in the emergency-contact audit trail");
 });

 it("never includes emergency contacts in global Office search",()=>{
  expect(search).not.toContain("office_emergency_contacts");
  expect(search).not.toContain("getEmergencyContactOverview");
 });

 it("protects mutations through same-origin server handling",()=>{
  expect(route).toContain("officeMutationIsSameOrigin(request)");
  expect(server).toContain("resolveOfficePermission");
 });
});
