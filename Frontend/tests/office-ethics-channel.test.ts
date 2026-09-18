import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180018_confidential_ethics_channel.sql",import.meta.url),"utf8");
const permissionEngine=readFileSync(new URL("../lib/office/permission-engine.ts",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/ethics-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-ethics/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-ethics.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const search=readFileSync(new URL("../lib/office/search-server.ts",import.meta.url),"utf8");

describe("KRAVIA confidential ethics channel",()=>{
 it("adds a non-bypass permission mode without changing existing default OWNER authority",()=>{
  expect(migration).toContain("owner_bypass boolean not null default true");
  expect(migration).toContain("'ethics.case.read'");
  expect(migration).toContain("false)");
  expect(permissionEngine).toContain('permissionResult.data.owner_bypass !== false');
 });

 it("requires explicit Ethics Investigator authority for restricted cases",()=>{
  expect(migration).toContain("'ETHICS_INVESTIGATOR'");
  expect(migration).toContain("owner_managed_only");
  expect(migration).toContain("Reporter cannot investigate their own case");
  expect(server).toContain('profile_code","ETHICS_INVESTIGATOR');
 });

 it("keeps reporter follow-up separate from restricted investigator notes",()=>{
  expect(migration).toContain("visibility in ('REPORTER','INVESTIGATOR')");
  expect(migration).toContain("Reporter can only add reporter-visible notes");
  expect(component).toContain("Reporter-visible");
  expect(component).toContain("Investigator-only");
 });

 it("requires independent case closure and reporter-safe outcome",()=>{
  expect(migration).toContain("Reporter/investigator cannot independently close the same ethics case");
  expect(migration).toContain("reporter-safe outcome summaries are required");
  expect(component).toContain("Independent closure review");
 });

 it("is available for confidential reporting but not global Office search",()=>{
  expect(officeSections.ethics.title).toBe("Ethics channel");
  expect(requiredCapabilities("office","ethics")).toContain("ethics.report");
  expect(screen).toContain("OfficeEthicsChannel");
  expect(search).not.toContain("getEthicsWorkspace");
  expect(search).not.toContain('kind: "ETHICS"');
 });

 it("states the confidentiality boundary accurately and protects browser mutations",()=>{
  expect(server).toContain("confidential and excluded from normal manager/HR search surfaces");
  expect(server).toContain("does not represent it as technically anonymous");
  expect(route).toContain("officeMutationIsSameOrigin(request)");
 });
});
