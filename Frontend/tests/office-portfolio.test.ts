import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180023_project_portfolio.sql",import.meta.url),"utf8");
const lifecycle=readFileSync(new URL("../../Database/supabase/migrations/202609180024_project_portfolio_lifecycle.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/portfolio-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-portfolio/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-portfolio.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const calendar=readFileSync(new URL("../lib/office/calendar-server.ts",import.meta.url),"utf8");
const search=readFileSync(new URL("../lib/office/search-server.ts",import.meta.url),"utf8");

describe("KRAVIA project and portfolio controls",()=>{
 it("is a capability-gated Office module",()=>{
  expect(officeSections.portfolio.title).toBe("Projects & portfolio");
  expect(requiredCapabilities("office","portfolio")).toContain("portfolio.read");
  expect(requiredCapabilities("office","portfolio")).toContain("portfolio.milestone.manage");
  expect(requiredCapabilities("office","portfolio")).toContain("portfolio.team.manage");
  expect(requiredCapabilities("office","portfolio")).toContain("portfolio.member.read");
  expect(screen).toContain("OfficePortfolioWorkspace");
 });

  it("gives participants assigned-project context without department-wide authority",()=>{
  expect(server).toContain('"portfolio.member.read"');
  expect(server).toContain('.eq("user_id",current.identity.userId).eq("active",true)');
  expect(server).toContain("Participant read reveals only assigned project context");
  expect(calendar).toContain('"portfolio.member.read"');
  expect(calendar).toContain("participantProjectIds");
  expect(search).toContain("getPortfolioOverview");
  expect(search).toContain('kind: "PROJECT"');
  expect(search).toContain('kind: "MILESTONE"');
 });

 it("requires independent project approval and evidence-backed completion",()=>{
  expect(migration).toContain("Project owner/creator cannot independently review the same project");
  expect(migration).toContain("All open milestones must be completed or cancelled before project completion");
  expect(migration).toContain("Project completion evidence is required");
  expect(component).toContain("Completion evidence");
 });

 it("uses explicit human-reported health rather than telemetry-derived scoring",()=>{
  expect(migration).toContain("reported_health");
  expect(migration).toContain("Health note is required for at-risk/off-track status");
  expect(server).toContain("KRAVIA does not derive employee or project performance scores from login time, commits, passive activity or task counts");
  expect(component).toContain("human-reported at risk");
 });

 it("prevents dependency cycles and blocks successor start until predecessors are done",()=>{
  expect(migration).toContain("Milestone dependency would create a cycle");
  expect(lifecycle).toContain("Milestone dependency would create a cycle");
  expect(lifecycle).toContain("Milestone dependencies must be completed before work starts");
  expect(component).toContain("Depends on");
 });

 it("changes dependencies and membership by state instead of destructive delete",()=>{
  expect(lifecycle).toContain("PROJECT_MEMBER_DEACTIVATED");
  expect(lifecycle).toContain("MILESTONE_DEPENDENCY_DISABLED");
  expect(lifecycle).not.toMatch(/delete\s+from\s+public\.office_portfolio_(dependencies|members)/i);
  expect(component).toContain("Project membership is descriptive metadata. It does not grant KRAVIA permissions.");
 });

 it("protects mutations with server-side scope and same-origin checks",()=>{
  expect(route).toContain("officeMutationIsSameOrigin(request)");
  expect(server).toContain("resolveOfficePermission");
  expect(server).toContain("currentOfficeTrustedDeviceId");
  expect(route).toContain("CREATE_PROJECT");
  expect(route).toContain("TRANSITION_MILESTONE");
 });
});
