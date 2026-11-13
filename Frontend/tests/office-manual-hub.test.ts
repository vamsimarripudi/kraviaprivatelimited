import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
import { OFFICE_MANUAL_VERSION, commonManual,manualRoles,manualKey,resolveManualRoleIds } from "../lib/office/manuals";
import { renderOfficeManualPdf } from "../lib/office/manual-pdf";
import { getDetailedCommonManual,getDetailedRoleManual } from "../lib/office/manual-full-reader";
import { capabilityCanAccessSection } from "../lib/office/workspace-capabilities";
import { financeSections,officeSections } from "../lib/office/workspaces";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

describe("Office Info and Help: assignment, privacy and versioning",()=>{
  it("publishes 26 non-identifying role guides plus the common onboarding flow",()=>{
    expect(manualRoles).toHaveLength(26);
    expect(new Set(manualRoles.map(role=>role.id)).size).toBe(26);
    expect(commonManual).toHaveLength(8);
    expect(commonManual.some(chapter=>chapter.steps.some(step=>step.includes("Authenticator")))).toBe(true);
  });
  it("keeps Founder and engineering responsibilities as separate guide supplements",()=>{
    expect(resolveManualRoleIds({roles:["OWNER"],jobTitle:"Founder & CTO",positionCodes:["FULLSTACK_DEVELOPER"]})).toEqual([
      "founder-owner","cto-engineering-head","full-stack-developer"
    ]);
  });
  it("supports company secretary, Finance-only, external auditor and trainee identities",()=>{
    expect(resolveManualRoleIds({roles:["CS"]})).toEqual(["company-secretary"]);
    expect(resolveManualRoleIds({roles:["FINANCE"]})).toEqual(["finance-analyst-payroll"]);
    expect(resolveManualRoleIds({roles:["AUDITOR"]})).toEqual(["independent-auditor"]);
    expect(resolveManualRoleIds({roles:["MEMBER"],relationship:"TRAINEE"})).toContain("trainee");
    expect(manualRoles.find(role=>role.id==="company-secretary")?.name).toContain("Company Secretary");
  });
  it("does not introduce a new Owner entitlement or expose an arbitrary role key",()=>{
    expect(manualKey("common")).toBe("COMMON");
    expect(manualKey("full-stack-developer")).toBe("ROLE:FULL-STACK-DEVELOPER");
    expect(()=>manualKey("../../private")).toThrow("Unknown role manual");
    expect(resolveManualRoleIds({roles:["MEMBER"],jobTitle:"General Associate"})).toEqual(["general-employee"]);
  });
  it("registers Office Info and Finance employee self-service without blanket Finance permissions",()=>{
    expect(officeSections.info).toBeTruthy();
    expect(financeSections.info).toBeTruthy();
    expect(financeSections["my-role"]).toBeTruthy();
    expect(capabilityCanAccessSection("finance","info",["FINANCE"],[])).toBe(true);
    expect(capabilityCanAccessSection("finance","my-role",["CA"],[])).toBe(true);
    expect(capabilityCanAccessSection("finance","payments",["FINANCE"],[])).toBe(false);
    expect(capabilityCanAccessSection("office","info",["MEMBER"],[])).toBe(true);
    expect(capabilityCanAccessSection("office","access",["MEMBER"],[])).toBe(false);
  });
  it("uses server-side actor resolution and self-only role filtering",()=>{
    const server=read("lib/office/manual-server.ts");
    const api=read("app/api/office-manual/route.ts");
    const pdf=read("app/api/office-manual/download/route.ts");
    expect(server).toContain("requireOfficeActor()");
    expect(server).toContain("getOfficeCapabilitySnapshot");
    expect(server).toContain("roleCanAccessSection");
    expect(server).toContain("capabilityCanAccessSection");
    expect(server).toContain('.eq("user_id",identity.userId)');
    expect(server).toContain("if(!allowed.has(input.key))");
    expect(api).toContain("officeMutationIsSameOrigin");
    expect(pdf).toContain("getOfficeManualHub()");
    expect(pdf).not.toContain("searchParams.get(\"employee\")");
  });
  it("keeps append-only receipt events and user-scoped records behind service-role RLS",()=>{
    const ddl=read("../Database/supabase/migrations/202611130031_office_manual_acknowledgements.sql");
    expect(ddl).toContain("alter table public.office_manual_receipts enable row level security");
    expect(ddl).toContain("alter table public.office_manual_receipt_events enable row level security");
    expect(ddl).toContain("revoke all on public.office_manual_receipts");
    expect(ddl).toContain("p_action='ACKNOWLEDGE' and previous_status is null");
    expect(ddl).toContain("if previous_status is distinct from next_status");
    expect(ddl).toContain("to service_role");
  });
  it("serves the original full-length audited materials, not only short summaries",()=>{
    const common=getDetailedCommonManual();
    const founder=getDetailedRoleManual("founder-owner");
    const trainee=getDetailedRoleManual("trainee");
    expect(common.length).toBeGreaterThan(25000);
    expect(founder.length).toBeGreaterThan(3000);
    expect(founder).toContain("Worked example");
    expect(trainee).toContain("End of day");
    expect(()=>getDetailedRoleManual("another-employee-private-record")).toThrow();
    const source=read("manual-content/role-guides-full.md");
    expect((source.match(/^## Role guide · /gm)||[]).length).toBe(26);
    expect(source).toContain(founder);
    expect(source).toContain(trainee);
  });
  it("writes detailed original manual content into the personal PDF",()=>{
    const pdf=renderOfficeManualPdf({edition:OFFICE_MANUAL_VERSION,
      common:commonManual,roles:[manualRoles.find(role=>role.id==="trainee")!],
      routes:[{href:"/office/tasks",title:"Company inbox",description:"Assigned tasks"}],
      fullCommon:getDetailedCommonManual(),
      fullRoles:[getDetailedRoleManual("trainee")],
    });
    const source=Buffer.from(pdf).toString("ascii");
    expect(source).toContain("COMPLETE PUBLISHED EDITION");
    expect(source).toContain("Worked example");
    expect(source).toContain("PRIVATE EMPLOYEE USER MANUAL");
    expect(source).toContain("%%EOF");
  });

  it("generates a syntactically valid PDF envelope with current role and route info",()=>{
    const pdf=renderOfficeManualPdf({edition:OFFICE_MANUAL_VERSION,
      common:commonManual,roles:[manualRoles.find(role=>role.id==="trainee")!],
      routes:[{href:"/office/tasks",title:"Company inbox",description:"Assigned tasks"}]});
    const text=Buffer.from(pdf).toString("ascii");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("xref\n");
    expect(text).toContain("%%EOF");
    expect(text).toContain("ROLE GUIDE: TRAINEE");
    expect(text).toContain("/office/tasks");
    const count=Number(text.match(/\/Count (\d+)/)?.[1]);
    expect(count).toBeGreaterThan(1);
    expect(text).toContain("/Root 1 0 R");
  });
  it("ensures no private internal role manual is published on the unauthenticated quick-start route",()=>{
    const safe=read("app/office/quick-start/page.tsx");
    expect(safe).toContain("Public registration is closed");
    expect(safe).toContain("Full employee manuals and acknowledgement records are private");
    expect(safe).not.toContain("Bank account number");
  });
});
