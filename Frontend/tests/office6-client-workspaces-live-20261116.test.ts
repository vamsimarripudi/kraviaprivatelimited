import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const active=[
"office-work-hub","office-recruitment-workspace","office-payroll-console","office-it-service",
"office-people-development","office-budget","office-asset-lifecycle","office-physical-office",
"office-contract-workspace","office-portfolio","office-support-operations","office-strategy",
"office-knowledge-hub","office-workforce-lifecycle","office-crm-workspace","office-company-inbox",
"office-worktime-console","office-organization-chart","office-finance-command-center"
];
describe("KRAVIA Office client-only live real workflows",()=>{
 it("revalidates 19 existing authorized domain sources without mock data",()=>{
  expect(active).toHaveLength(19);
  for(const n of active){
   const source=read("components/"+n+".tsx");
   expect(source,n).toContain("useOfficeLiveRefresh");
   expect(source,n).toMatch(/\/api\/office-[a-z0-9/-]+/i);
  }
 });
 it("relies on the existing authenticated notification stream for invalidation",()=>{
  const s=read("components/office-notification-hub.tsx");
  expect(s).toContain('new Event("kravia-office-live-change")');
  expect(s).toContain('new EventSource("/api/office-notifications/events"');
 });
 it("only refreshes the visible active module and protects unsaved form inputs",()=>{
  const s=read("lib/office/use-office-live-refresh.ts");
  for(const value of ["document.visibilityState", "busy.current", "window.setInterval",
    "window.clearInterval", "paused", "closest(", "kravia-office-live-change"]){
    expect(s).toContain(value);
  }
 });
 it("preserves main's assigned-department client switcher and scope checks",()=>{
  const shell=read("components/office-workspace-shell.tsx");
  const navigation=read("lib/office/client-department-navigation.ts");
  expect(shell).toContain("officeAssignedDepartmentCodes");
  expect(shell).toContain("officeClientSectionVisible");
  expect(shell).toContain("blockedClientSection");
  expect(navigation).toContain("officeDepartmentForSection");
 });
});
