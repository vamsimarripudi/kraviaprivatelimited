import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180037_asset_lifecycle.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/asset-lifecycle-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-assets/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-asset-lifecycle.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA asset lifecycle",()=>{
 it("is wired through scoped asset capabilities",()=>{
  expect(requiredCapabilities("office","assets")).toContain("operations.asset.read");
  expect(requiredCapabilities("office","assets")).toContain("operations.asset.wipe");
  expect(requiredCapabilities("office","assets")).toContain("operations.asset.dispose");
  expect(screen).toContain("OfficeAssetLifecycle");
 });

 it("extends rather than replaces the canonical asset registry",()=>{
  expect(migration).toContain("Extends the legacy office_assets registry without replacing it");
  expect(migration).toContain("Canonical asset not found");
  expect(server).toContain('readOfficeRuntimeResult<Array<Record<string,unknown>>>("assets")');
  expect(server).not.toContain('from("office_assets")');
 });

 it("tracks assignment, return, repair, wipe, reissue, loss and disposal",()=>{
  for(const state of ["ASSIGNED","RETURN_PENDING","REPAIR","WIPE_PENDING","READY_FOR_REISSUE","DISPOSAL_PENDING","DISPOSED","LOST"])expect(migration).toContain(state);
  expect(component).toContain("REQUEST_RETURN");
  expect(component).toContain("SEND_REPAIR");
  expect(component).toContain("REQUEST_DISPOSAL");
 });

 it("requires independent wipe/disposal evidence and never stores wipe credentials",()=>{
  expect(migration).toContain("Secure-wipe evidence reference is required");
  expect(migration).toContain("Last lifecycle operator cannot independently approve disposal");
  expect(migration).toContain("Verified secure-wipe evidence is required before disposal");
  expect(migration).not.toMatch(/recovery_key|wipe_password|device_password|private_key/i);
  expect(server).toContain("Device passwords, recovery keys, wipe credentials and private secrets are never stored here");
 });

 it("updates the canonical assignee/status through governed lifecycle functions",()=>{
  expect(migration).toContain("update public.office_assets set assigned_employee_id=employment_code");
  expect(migration).toContain("update public.office_assets set assigned_employee_id=null");
  expect(migration).toContain("status='DISPOSED'");
 });

 it("protects browser mutations",()=>{
  expect(route).toContain("officeMutationIsSameOrigin(request)");
 });
});
