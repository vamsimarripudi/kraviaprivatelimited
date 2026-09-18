import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180013_people_development_workforce_planning.sql",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-people-development/route.ts",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/people-development-server.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-people-development.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA People Development",()=>{
 it("is capability-gated and wired into Office",()=>{
   expect(officeSections.development.title).toBe("People development");
   expect(requiredCapabilities("office","development")).toContain("people.training.read");
   expect(requiredCapabilities("office","development")).toContain("people.performance.read");
   expect(screen).toContain("OfficePeopleDevelopment");
 });
 it("keeps skill verification independent from self declaration",()=>{
   expect(migration).toContain("Self-verification is not allowed");
   expect(migration).toContain("Verification evidence is required");
   expect(component).toContain("Declare skill");
 });
 it("requires evidence for controlled training completion",()=>{
   expect(migration).toContain("Completion evidence is required");
   expect(route).toContain("TRANSITION_TRAINING");
   expect(component).toContain("Completion evidence");
 });
 it("uses explicit human performance review and never telemetry scoring",()=>{
   expect(migration).toContain("Performance reviewer cannot be the review subject");
   expect(migration).toContain("Self-review is not allowed");
   expect(migration).not.toMatch(/commit_count|login_hours|mouse|keystroke|telemetry_score/i);
   expect(server).toContain("does not calculate employee performance from login duration");
   expect(component).toContain("Human outcome");
 });
 it("prevents workforce plan creators from approving their own plan",()=>{
   expect(migration).toContain("Workforce plan creator cannot approve their own plan");
   expect(migration).toContain("Independent workforce plan review permission is required");
   expect(component).toContain("Approved headcount");
 });
 it("keeps browser mutations same-origin",()=>{
   expect(route).toContain("officeMutationIsSameOrigin(request)");
 });
});
