import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180036_vendor_customer_trust.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/trust-center-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-trust-center/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-trust-center.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA Trust Center",()=>{
 it("is wired as a capability-scoped Office workspace",()=>{
  expect(officeSections.trust.title).toBe("Trust Center");
  expect(requiredCapabilities("office","trust")).toContain("vendor.assurance.read");
  expect(requiredCapabilities("office","trust")).toContain("customer.trust.read");
  expect(screen).toContain("OfficeTrustCenter");
 });

 it("keeps vendor assessment approval independent from owner/creator",()=>{
  expect(migration).toContain("Assessment owner/creator cannot independently review the same vendor assessment");
  expect(migration).toContain("Approval requires evidence and future expiry");
  expect(component).toContain("Review / advance");
 });

 it("validates canonical vendors/customers without taking ownership of their master records",()=>{
  expect(migration).toContain("Canonical vendor not found");
  expect(migration).toContain("Canonical customer not found");
  expect(server).toContain('readOfficeRuntimeResult<Array<Record<string,unknown>>>("vendors")');
  expect(server).toContain('readOfficeRuntimeResult<Array<Record<string,unknown>>>("customers")');
  expect(server).not.toContain('from("vendors")');
  expect(server).not.toContain('from("customers")');
 });

 it("requires response and evidence before customer trust review",()=>{
  expect(migration).toContain("Response and evidence references are required before review");
  expect(migration).toContain("Trust-request owner/creator cannot independently review the same response");
  expect(component).toContain("Independent review");
 });

 it("requires a delivery reference before a trust response is marked sent",()=>{
  expect(migration).toContain("External delivery/reference evidence is required");
  expect(component).toContain("Record delivery");
  expect(server).toContain("does not fabricate certifications, pen-test outcomes, DPA acceptance");
 });

 it("protects browser mutations",()=>{
  expect(route).toContain("officeMutationIsSameOrigin(request)");
 });
});
