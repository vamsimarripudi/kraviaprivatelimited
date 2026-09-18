import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { financeSections, officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180018_confidential_ethics_channel.sql",import.meta.url),"utf8");
const segregation=readFileSync(new URL("../../Database/supabase/migrations/202609180019_ethics_segregation_hardening.sql",import.meta.url),"utf8");
const stateMachine=readFileSync(new URL("../../Database/supabase/migrations/202609180020_ethics_state_machine_hardening.sql",import.meta.url),"utf8");
const permissionEngine=readFileSync(new URL("../lib/office/permission-engine.ts",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/ethics-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-ethics/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-ethics.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const search=readFileSync(new URL("../lib/office/search-server.ts",import.meta.url),"utf8");

describe("KRAVIA confidential ethics channel",()=>{
 it("supports non-bypass permissions so OWNER does not automatically gain restricted case access",()=>{
  expect(migration).toContain("owner_bypass boolean not null default true");
  expect(migration).toContain("'ethics.case.read'");
  expect(permissionEngine).toContain('permissionResult.data.owner_bypass !== false');
  expect(segregation).toContain("'ethics.case.assign'");
  expect(segregation).toContain("owner_bypass=false");
 });

 it("separates case lead, investigator and independent reviewer authority",()=>{
  expect(segregation).toContain("'ETHICS_LEAD'");
  expect(segregation).toContain("'ETHICS_INVESTIGATOR'");
  expect(segregation).toContain("'ETHICS_REVIEWER'");
  expect(segregation).toContain("where profile_code='ETHICS_INVESTIGATOR' and permission_code='ethics.case.review'");
  expect(segregation).toContain("Ethics case lead cannot assign the same case to themselves");
  expect(requiredCapabilities("office","ethics")).toContain("ethics.case.assign");
 });

 it("limits case visibility by relationship instead of exposing all restricted cases",()=>{
  expect(server).toContain('.eq("reporter_user_id",current.identity.userId)');
  expect(server).toContain('.eq("investigator_user_id",current.identity.userId)');
  expect(server).toContain('.eq("status","AWAITING_REVIEW")');
  expect(server).toContain('access_mode=reporter?"REPORTER":assignedInvestigator?"INVESTIGATOR":independentReviewer?"REVIEWER":lead?"LEAD":"RESTRICTED"');
  expect(server).toContain("reporter_user_id:reporter||assignedInvestigator||independentReviewer");
 });

 it("keeps reporter-visible notes separate from investigator-only evidence",()=>{
  expect(migration).toContain("visibility in ('REPORTER','INVESTIGATOR')");
  expect(migration).toContain("Reporter can only add reporter-visible notes");
  expect(component).toContain("Reporter-visible");
  expect(component).toContain("Investigator-only");
 });

 it("enforces an investigation state machine and independent closure",()=>{
  expect(stateMachine).toContain("Triaged case must enter investigation");
  expect(stateMachine).toContain("Investigating case must move to action pending or independent review");
  expect(stateMachine).toContain("Reporter/investigator cannot independently close the same ethics case");
  expect(stateMachine).toContain("Restricted and reporter-safe outcome summaries are required");
  expect(component).toContain("Independent closure review");
 });

 it("is available to Office and Finance for confidential reporting but excluded from global search",()=>{
  expect(officeSections.ethics.title).toBe("Ethics channel");
  expect(financeSections.ethics.title).toBe("Ethics channel");
  expect(requiredCapabilities("office","ethics")).toContain("ethics.report");
  expect(requiredCapabilities("finance","ethics")).toContain("ethics.report");
  expect(screen).toContain("OfficeEthicsChannel");
  expect(search).not.toContain("getEthicsWorkspace");
  expect(search).not.toContain('kind: "ETHICS"');
 });

 it("states the confidentiality boundary accurately and protects browser mutations",()=>{
  expect(server).toContain("confidential but not technically anonymous");
  expect(server).toContain("Ordinary owner, executive, HR, admin and manager roles do not receive ethics-case access");
  expect(route).toContain("officeMutationIsSameOrigin(request)");
 });
});
