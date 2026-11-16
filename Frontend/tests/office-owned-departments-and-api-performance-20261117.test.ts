import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  OFFICE_DEPARTMENT_SECTIONS,
  officeAssignedDepartmentCodes,
  officeClientSectionVisible,
  officeDepartmentForSection,
} from "../lib/office/client-department-navigation";
import { capabilityCanAccessSection } from "../lib/office/workspace-capabilities";

const read = (path:string) => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const shell=read("components/office-workspace-shell.tsx");
const navApi=read("app/api/office-my-departments/route.ts");
const perms=read("lib/office/permission-engine.ts");
const snapshot=read("lib/office/capability-server.ts");
const trust=read("lib/office/trust-center-server.ts");
const trustUI=read("components/office-trust-center.tsx");
const screen=read("components/internal-workspace-screen.tsx");
const support=read("lib/office/support-server.ts");

const jayaId="synthetic-jaya";
const jayaOwned=[
  "OPERATIONS","LEGAL","SECRETARIAL","CUSTOMER_SUCCESS","SUPPORT","SECURITY",
] as const;
const jayaDepartments={
  actor:{user_id:jayaId},
  departments:[...jayaOwned,"FINANCE","PEOPLE","SALES"].map(code=>({code,label:code})),
  ownership:jayaOwned.map(department_code=>({department_code,owner_user_id:jayaId})),
};

describe("KRAVIA Office scoped multi-department owner access",()=>{
  it("makes all six owned departments available without exposing unowned Finance, HR or Sales",()=>{
    const departments=officeAssignedDepartmentCodes(jayaDepartments,jayaId,"OPERATIONS");
    expect(departments).toHaveLength(6);
    for(const code of jayaOwned)expect(departments).toContain(code);
    for(const code of ["FINANCE","PEOPLE","SALES"])expect(departments).not.toContain(code);
    expect(officeAssignedDepartmentCodes(jayaDepartments,"different-user","OPERATIONS")).toEqual([]);
  });
  it("routes each owned department to its own real workspace",()=>{
    const owned=officeAssignedDepartmentCodes(jayaDepartments,jayaId,"OPERATIONS");
    for(const route of ["support","customer-success","governance","registrations","compliance","contracts","assets","security"]){
      expect(officeClientSectionVisible(route,owned,false),route).toBe(true);
    }
    for(const route of ["customers","payroll","recruitment","crm","engineering"]){
      expect(officeClientSectionVisible(route,owned,false),route).toBe(false);
    }
    expect(officeDepartmentForSection("customer-success")).toBe("CUSTOMER_SUCCESS");
    expect(officeDepartmentForSection("customers")).toBe(null);
    expect(OFFICE_DEPARTMENT_SECTIONS.CUSTOMER_SUCCESS).toEqual(["customer-success"]);
    const slugs=Object.values(OFFICE_DEPARTMENT_SECTIONS).flat();
    expect(slugs).toHaveLength(new Set(slugs).size);
  });
  it("never treats department ownership as permission or device verification",()=>{
    expect(capabilityCanAccessSection("office","support",["ADMIN"],[])).toBe(false);
    expect(capabilityCanAccessSection("office","support",["ADMIN"],["support.case.read"])).toBe(true);
    expect(capabilityCanAccessSection("office","governance",["ADMIN","CS"],["secretarial.board.read"])).toBe(true);
    expect(capabilityCanAccessSection("office","customer-success",["ADMIN"],["customer.trust.read"])).toBe(true);
    expect(capabilityCanAccessSection("office","customers",["ADMIN"],["customer.trust.read"])).toBe(false);
    expect(capabilityCanAccessSection("office","payroll",["ADMIN"],["customer.trust.read"])).toBe(false);
    expect(snapshot).toContain("managedDeviceValid");
    expect(snapshot).toContain('currentOfficeTrustedDeviceId(admin,identity.userId)');
    expect(snapshot).toContain('ownedDeviceRequired');
    expect(snapshot).toContain('const requiresDevice=deviceEnforced||');
    expect(perms).toContain('decision.source === "DEPARTMENT_OWNER"');
    expect(perms).toContain('permission.high_risk || permission.requires_managed_device');
  });
  it("keeps all assigned categories in the sidebar; focus never restricts modules",()=>{
    expect(shell).toContain('fetch("/api/office-my-departments"');
    expect(shell).toContain("officeClientSectionVisible(slug,visibleDepartments,isFounder)");
    expect(shell).toContain("visibleDepartments.map(officeDepartmentLabel)");
    expect(shell).not.toContain("officeClientSectionVisible(slug,activeDepartment?[activeDepartment]:[],isFounder)");
    expect(shell).toContain("officeClientSectionVisible");
    expect(shell).toContain("blockedClientSection");
  });
  it("uses a lightweight authenticated GET without ownership transfer history or employee directory",()=>{
    expect(navApi).toContain("requireOfficeActor()");
    expect(navApi).toContain('admin.from("office_department_ownership")');
    expect(navApi).toContain('.eq("owner_user_id", identity.userId)');
    expect(navApi).toContain('admin.from("office_department_catalog")');
    expect(navApi).toContain('"Cache-Control": "private, no-store"');
    expect(navApi).toContain('"Vary": "Cookie"');
    expect(navApi).not.toContain("office_department_transfer_requests");
    expect(navApi).not.toContain("office_identity_users");
    expect(navApi).not.toContain("service_role");
  });
  it("opens Customer Success into the live customer trust workflow, never Sales master",()=>{
    expect(screen).toContain('section === "customer-success" ? <OfficeTrustCenter initialView="customers" />');
    expect(trustUI).toContain('initialView="vendors"');
    expect(trustUI).toContain('visibleView==="customers"');
    expect(trust).toContain("customer.trust.read");
    expect(trust).toContain("currentOfficeTrustedDeviceId");
  });
  it("parallelizes independent checks without bypassing explicit company denies",()=>{
    expect(snapshot).toContain("departmentDeltaResult, globalDeniesResult, formerOwnerResult,");
    expect(snapshot).toContain("profilesResult, overridesResult");
    expect(perms).toContain("const [permissionResult, ownershipResult, overrideResult] = await Promise.all([");
    expect(perms).toContain('row.scope_type === "COMPANY" || scopeMatches(');
    expect(trust).toContain('const decisions=await Promise.all(codes.map(code=>');
    expect(support).toContain('permission("support.case.read", verifiedActor)');
    expect(support).toContain('const [canManage,canRefund] = await Promise.all([');
    expect(support).toContain('read.admin.from(table).select(columns).in("id",batch)');
    expect(support).toContain('reference_status: referenceStatus');
    expect(support).not.toContain('readOfficeRuntimeResult');
    expect(trust).toContain('current.admin.from("customers")');
    expect(trust).toContain('current.admin.from("vendors")');
    expect(trust).not.toContain('readOfficeRuntimeResult');
  });
});
