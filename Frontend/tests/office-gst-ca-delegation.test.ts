import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=read("../Database/supabase/migrations/20261115163001_ca_gst_operational_access.sql");
const access=read("lib/office/access-policy.ts");
const screen=read("components/internal-workspace-screen.tsx");
const gst=read("components/office-gst-tax.tsx");
const backend=read("../Backend/backend/gst_compliance.py");
const gsp=read("../Backend/backend/gst_gsp_fynamics.py");
const permissions=read("lib/office/permission-engine.ts");

describe("CA professional: complete operational GST delegation",()=>{
 it("grants tax approval and company statutory registration management through the scoped CA_TAX profile",()=>{
  for(const code of [
   "tax.gst.approve","registration.manage","finance.bank.read",
   "document.finance.create","document.instance.read",
   "document.instance.review","document.render"
  ])expect(sql).toContain(`('CA_TAX','${code}','ALLOW','COMPANY')`);
  expect(sql).toContain("on conflict (profile_code,permission_code)");
  expect(sql).toContain("Active CA role missing");
  expect(sql).toContain("Active CA_TAX profile must exist");
 });
 it("keeps AAL2/device authorization and does not create or appoint an actual CA identity",()=>{
  expect(sql).toContain("high_risk=true and requires_managed_device=true");
  expect(sql).not.toMatch(/insert into public\.office_user_roles/i);
  expect(sql).not.toMatch(/insert into public\.office_user_access_profiles/i);
  expect(access).toContain('adminAssignableRoles: readonly OfficeRole[] = ["MEMBER", "FINANCE", "CA"');
  expect(permissions).toContain('identity.aal !== "aal2"');
  expect(permissions).toContain("A trusted company-managed device is required");
 });
 it("allows CA preparation and approval but preserves authorized-signatory separation",()=>{
  expect(screen).toContain('canPrepare={permissions.includes("tax.gst.prepare")}');
  expect(screen).toContain('canApprove={permissions.includes("tax.gst.approve")}');
  expect(screen).toContain('canSignatory={identity.roles.includes("OWNER") && permissions.includes("tax.gst.approve")}');
  expect(gsp).toContain('require_roles("CA")');
  expect(gsp).toContain('require_roles("OWNER")');
  expect(backend).toContain('require_roles("OWNER", "CA")');
 });
 it("leaves GST electronic invoicing gated off and retains registration/filing tabs",()=>{
  expect(gst).toContain("const EINVOICE_UI_ENABLED = false;");
  expect(gst).toContain('key: "changes", label: "Registration changes"');
  expect(gst).toContain('key: "returns", label: "Returns"');
  expect(gst).toContain("ARN verified");
  expect(sql).not.toContain("GST_EINVOICE_ENABLED=true");
 });
});
