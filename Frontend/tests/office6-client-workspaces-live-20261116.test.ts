import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {officeSections} from "../lib/office/workspaces";
import {officeDepartmentLabels,officeSectionDepartments,clientOfficeSectionCategory,
 isOfficePersonalSection} from "../lib/office/client-department-navigation";
import {capabilityCanAccessSection} from "../lib/office/workspace-capabilities";
const file=(name:string)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const shell=file("components/office-workspace-shell.tsx");
const screen=file("components/internal-workspace-screen.tsx");
const context=file("components/office-workspace-context.tsx");
const deptHook=file("lib/office/use-office-client-departments.ts");
const liveHook=file("lib/office/use-office-live-refresh.ts");
const notification=file("components/office-notification-hub.tsx");
describe("KRAVIA 6 client-only live department navigation",()=>{
 it("covers every Office section with an assigned department, company control or personal route",()=>{
  for(const slug of Object.keys(officeSections)){
   expect(isOfficePersonalSection(slug)||Array.isArray(officeSectionDepartments[slug]),
     slug).toBe(true);
  }
  expect(Object.keys(officeDepartmentLabels)).toHaveLength(20);
 });
 it("only shows Manohar's actual four departments, not other directors' tools",()=>{
  const assigned=["EXECUTIVE","FINANCE","PEOPLE","PRODUCT"];
  expect(clientOfficeSectionCategory("people",assigned,false)).toBe("People & HR");
  expect(clientOfficeSectionCategory("payroll",assigned,false)).toBe("Finance");
  expect(clientOfficeSectionCategory("products",assigned,false)).toBe("Product");
  expect(clientOfficeSectionCategory("decisions",assigned,false)).toBe("Executive");
  for(const slug of ["it","engineering","governance","contracts","crm","quality","access"])
   expect(clientOfficeSectionCategory(slug,assigned,false),slug).toBe(null);
 });
 it("only shows Jaya's operating, legal and secretarial departments",()=>{
  const assigned=["OPERATIONS","LEGAL","SECRETARIAL"];
  expect(clientOfficeSectionCategory("assets",assigned,false)).toBe("Operations");
  expect(clientOfficeSectionCategory("contracts",assigned,false)).toBe("Legal");
  expect(clientOfficeSectionCategory("governance",assigned,false)).toBe("Secretarial");
  for(const slug of ["people","payroll","products","engineering","crm","it"])
   expect(clientOfficeSectionCategory(slug,assigned,false),slug).toBe(null);
 });
 it("separates Founder oversight from operational department assignments",()=>{
  expect(clientOfficeSectionCategory("strategy",["EXECUTIVE"],true)).toBe("Company Control");
  expect(clientOfficeSectionCategory("access",["EXECUTIVE"],true)).toBe("Company Control");
  expect(clientOfficeSectionCategory("recruitment",["EXECUTIVE"],true)).toBe(null);
  expect(clientOfficeSectionCategory("engineering",["EXECUTIVE"],true)).toBe(null);
 });
 it("keeps unassigned employees in personal work only and maintains current server capabilities",()=>{
  expect(clientOfficeSectionCategory("dashboard",[],false)).toBe("My work");
  expect(clientOfficeSectionCategory("emergency",[],false)).toBe("My work");
  expect(clientOfficeSectionCategory("people",[],false)).toBe(null);
  expect(capabilityCanAccessSection("office","people",["DIRECTOR"],[])).toBe(false);
  expect(shell).toContain("roleCanAccessSection(value, identity.roles)");
  expect(shell).toContain("capabilityCanAccessSection(workspace, slug, identity.roles, permissions)");
 });
 it("fails closed while department assignments are unavailable and filters direct URLs/dashboard links",()=>{
  expect(deptHook).toContain('"/api/office-departments"');
  expect(deptHook).toContain('source.actor?.user_id!==userId');
  expect(deptHook).toContain("o.owner_user_id===userId");
  expect(deptHook).toContain('status:"unavailable",codes:[]');
  expect(deptHook).toContain('document.visibilityState==="visible"');
  expect(context).toContain("visibleSections: readonly string[]");
  expect(screen).toContain("visibleSections.includes(String(section))");
  expect(screen).toContain("visibleSections.includes(slug)");
  expect(shell).toContain('assigned.status==="ready"');
  expect(shell).toContain("data-office-dept-sync-state");
 });
 it("revalidates only mounted real-work modules without unsaved-form interference",()=>{
  expect(liveHook).toContain('document.visibilityState!=="visible"');
  expect(liveHook).toContain("window.setInterval(sync,delay)");
  expect(liveHook).toContain("active");
  expect(liveHook).toContain("closest(\"form,[role='dialog'],[contenteditable='true']\")");
  expect(notification).toContain('new Event("kravia-office-live-change")');
  for(const f of ["office-work-hub","office-recruitment-workspace","office-payroll-console","office-it-service"])
   expect(file("components/"+f+".tsx"),f).toContain("useOfficeLiveRefresh");
 });
});
