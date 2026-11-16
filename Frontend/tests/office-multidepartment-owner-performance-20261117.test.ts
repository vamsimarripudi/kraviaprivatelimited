import { describe,expect,it } from "vitest";
import {readFileSync} from "node:fs";
import {
  OFFICE_DEPARTMENT_SECTIONS,OFFICE_DEPARTMENT_LABELS,officeAssignedDepartmentCodes,
  officeClientSectionVisible,officeDepartmentForSection,
} from "../lib/office/client-department-navigation";
import {capabilityCanAccessSection,requiredCapabilities} from "../lib/office/workspace-capabilities";
import {officeSections} from "../lib/office/workspaces";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const shell=read("components/office-workspace-shell.tsx");
const deptRoute=read("app/api/office-departments/route.ts");
const trustRoute=read("app/api/office-trust-center/route.ts");
const trustServer=read("lib/office/trust-center-server.ts");
const support=read("lib/office/support-server.ts");
const supportUI=read("components/office-support-operations.tsx");
const successUI=read("components/office-trust-center.tsx");
const screen=read("components/internal-workspace-screen.tsx");
const migration=read("../Database/supabase/migrations/20261117090000_department_owner_module_reads.sql");

const actor="synthetic-multidept-owner",other="synthetic-other";
const assigned=["CUSTOMER_SUCCESS","LEGAL","OPERATIONS","SECRETARIAL","SECURITY","SUPPORT"];
const snapshot={
  actor:{user_id:actor},
  departments:assigned.map(code=>({code,label:OFFICE_DEPARTMENT_LABELS[code]})),
  ownership:assigned.map(department_code=>({department_code,owner_user_id:actor})),
};
const permissions=[
  "support.case.read","support.case.manage","customer.trust.read",
  "secretarial.board.read","registration.read","compliance.rules.read",
  "operations.asset.read","security.overview.read",
];
const roles=["ADMIN","CS","LEGAL","OPERATIONS"] as const;

describe("KRAVIA multi-department navigation, real workflows and fast read models",()=>{
 it("keeps all six actual owner departments accessible without Finance/HR/Sales elevation",()=>{
  const codes=officeAssignedDepartmentCodes(snapshot,actor,"OPERATIONS");
  expect(codes).toEqual([...assigned].sort((a,b)=>OFFICE_DEPARTMENT_LABELS[a].localeCompare(OFFICE_DEPARTMENT_LABELS[b])));
  expect(officeAssignedDepartmentCodes(snapshot,other,"FINANCE")).toEqual([]);
  for(const code of assigned)expect(codes).toContain(code);
  for(const slug of ["support","customer-success","governance","registrations","compliance","assets","facilities","security"]){
    expect(officeClientSectionVisible(slug,codes,false),slug).toBe(true);
  }
  for(const slug of ["customers","payroll","people","crm","recruitment"]){
    expect(officeClientSectionVisible(slug,codes,false),slug).toBe(false);
  }
  expect(officeClientSectionVisible("access",codes,false)).toBe(false);
  expect(shell).toContain("officeClientSectionVisible(slug,visibleDepartments,isFounder)");
  expect(shell).not.toContain("officeClientSectionVisible(slug,activeDepartment?[activeDepartment]:[],isFounder)");
 });
 it("routes Customer Success to actual Trust Center requests and does not alias it to Sales customer master",()=>{
  expect(officeDepartmentForSection("customer-success")).toBe("CUSTOMER_SUCCESS");
  expect(officeDepartmentForSection("customers")).toBe("SALES");
  expect(officeSections["customer-success"].roles).toContain("ADMIN");
  expect(requiredCapabilities("office","customer-success")).toContain("customer.trust.read");
  expect(requiredCapabilities("office","registrations")).toContain("registration.read");
  expect(capabilityCanAccessSection("office","registrations",roles,["registration.read"])).toBe(true);
  expect(capabilityCanAccessSection("office","customer-success",roles,permissions)).toBe(true);
  expect(capabilityCanAccessSection("office","support",roles,permissions)).toBe(true);
  expect(capabilityCanAccessSection("office","customers",roles,permissions)).toBe(false);
  expect(screen).toContain('section === "customer-success" ? <OfficeTrustCenter mode="customer" />');
  expect(successUI).toContain('mode==="customer"?"customers":"vendors"');
  expect(trustRoute).toContain('searchParams.get("view")==="customer"');
  expect(trustServer).toContain('view==="all"?can(current,"vendor.assurance.read",device):false');
 });
 it("keeps department source restricted and removes expensive employee/transfer fetch from every sidebar navigation load",()=>{
  expect(deptRoute).toContain('searchParams.get("view") === "navigation"');
  expect(deptRoute).toContain('.eq("owner_user_id",identity.userId)');
  expect(deptRoute).toContain('"Cache-Control":"private, no-store"');
  expect(shell).toContain('fetch("/api/office-departments?view=navigation"');
  expect(shell).toContain("departmentLastFetchRef.current");
  expect(shell).toContain("Date.now()-departmentLastFetchRef.current>=30_000");
  expect(shell).toContain("kravia-office-departments-changed");
 });
 it("checks six customer-trust capabilities concurrently after one trusted-device lookup",()=>{
  expect(trustServer).toContain("const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId)");
  expect(trustServer).toContain("await Promise.all([");
  expect(trustServer).toContain('can(current,"customer.trust.read",device)');
  expect(trustServer).toContain('can(current,"customer.trust.manage",device)');
  expect(trustServer).toContain('can(current,"customer.trust.review",device)');
  expect(trustServer).toContain('id:row.id,legal_name:row.legal_name,display_name:row.display_name');
 });
 it("does not blank existing support cases when a supplementary backend catalog is unavailable",()=>{
  expect(support).toContain("async function permission(");
  expect(support).toContain("existingActor?: Awaited<ReturnType<typeof actor>>");
  expect(support).toContain("const [canManage,canRefund] = await Promise.all([");
  expect(support).toContain("reference_warnings: referenceWarnings");
  expect(support).toContain("if (eventsResult.error || ownersResult.error)");
  expect(supportUI).toContain("reference_warnings?");
  expect(supportUI).toContain("showIntake?<div");
 });
 it("preserves the live department inventory while noting that some have no dedicated module",()=>{
  expect(Object.keys(OFFICE_DEPARTMENT_LABELS)).toHaveLength(20);
  const all=Object.values(OFFICE_DEPARTMENT_SECTIONS).flat();
  expect(new Set(all).size).toBe(all.length);
  for(const code of ["ADMINISTRATION","AUDIT","IT","TAX"]){
    expect(OFFICE_DEPARTMENT_SECTIONS[code]).toEqual([]);
  }
  for(const module of all){
    expect(module in officeSections,module).toBe(true);
    const hasRoleSpecificRequirements=requiredCapabilities("office",module).length>0;
    const isPersonalUtility=capabilityCanAccessSection("office",module,["MEMBER"],[]);
    expect(hasRoleSpecificRequirements||isPersonalUtility,"Missing navigation authorization: "+module).toBe(true);
  }
 });
 it("allows current owners only explicit low-risk department reads, preserving denial and device checks",()=>{
  for(const code of [
    "support.case.read","customer.trust.read","secretarial.board.read",
    "registration.read","compliance.rules.read","operations.asset.read","facilities.room.read","security.overview.read"
  ])expect(migration).toContain("'"+code+"'");
  expect(migration).toContain("p.high_risk=false");
  expect(migration).toContain("p.owner_bypass is distinct from false");
  expect(migration).toContain("current_owner=p_actor");
  expect(migration).toContain("where i.user_id=p_actor and i.status='ACTIVE'");
  expect(migration).not.toContain("'finance.bank.read'");
  expect(migration).not.toContain("'people.sensitive.read'");
  expect(migration).toContain("revoke execute on function public.office_department_permission_verdict");
 });
});
