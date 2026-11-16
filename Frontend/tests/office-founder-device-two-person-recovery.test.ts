import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (path:string) => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=read("../Database/supabase/migrations/20261116215500_founder_device_independent_review.sql");
const server=read("lib/office/founder-device-review-server.ts");
const api=read("app/api/office-founder-device-review/route.ts");
const ui=read("components/office-founder-device-recovery.tsx");
const parent=read("components/office-device-identity.tsx");
const binder=read("components/office-trusted-device-link.tsx");
const binding=read("lib/office/device-binding-server.ts");

describe("Founder device independent security recovery, two-person authorization",()=>{
 it("retains revoked state until independent Director/Admin review and a distinct second approver",()=>{
  expect(sql).toContain("office_review_founder_device(");
  expect(sql).toContain("office_approve_founder_device(");
  expect(sql).toContain("p_actor=d.user_id");
  expect(sql).toContain("p_actor in (v.subject_user_id,v.reviewer_user_id)");
  expect(sql).toContain("r.role in ('ADMIN','DIRECTOR')");
  expect(sql).toContain("d.trust_state not in ('PENDING','REVOKED')");
  expect(sql).toContain("v.reviewed_at<now()-interval '72 hours'");
  expect(sql).toContain("p.compromise_detected is distinct from false");
  expect(sql).toContain("binding_token_hash=null");
  expect(sql).toContain("bound_at=null");
 });
 it("blocks former one-click Founder and self approval using legacy service-role procedure",()=>{
  expect(sql).toContain("Self-approval and Founder device approval require an independent two-person review");
  expect(sql).toContain("office_approve_device(");
  expect(sql).toContain("FOUNDER_DEVICE_APPROVED");
  expect(sql).toContain("FOUNDER_DEVICE_SECURITY_REVIEWED");
  expect(sql).toContain("status='APPROVED'");
 });
 it("enforces verified COMPLIANT evidence, never silently edits a historic compromised record",()=>{
  expect(sql).toContain("before insert or update on public.office_device_posture_snapshots");
  expect(sql).toContain("new.compromise_detected is distinct from false");
  expect(sql).toContain("new.encryption_enabled is distinct from true");
  expect(sql).toContain("new.firewall_enabled is distinct from true");
  expect(sql).toContain("Independent Defender scan".replace("Independent Defender scan","management_evidence_ref"));
  expect(sql).toContain("status='SUPERSEDED'");
  expect(sql).not.toContain("update public.office_device_posture_snapshots set compromise_detected=false");
 });
 it("keeps database access private, authenticated and same-origin",()=>{
  expect(sql).toContain("enable row level security");
  expect(sql).toContain("from public,anon,authenticated");
  expect(sql).toContain("to service_role");
  expect(server).toContain("requireOfficeActor()");
  expect(server).toContain('["DIRECTOR", "ADMIN"]');
  expect(server).toContain('!roles.includes("OWNER")');
  expect(api).toContain("officeMutationIsSameOrigin(request)");
  expect(api).toContain("z.discriminatedUnion");
  expect(api).toContain("z.literal(false)");
  expect(api).toContain("z.literal(true)");
  expect(api).toContain('"Cache-Control": "private, no-store"');
 });
 it("provides a simple actionable three-step UI without self approval or automated trust",()=>{
  expect(parent).toContain("<OfficeFounderDeviceRecovery");
  expect(ui).toContain("1 · Security review");
  expect(ui).toContain("2 · Independent approval");
  expect(ui).toContain("3 · Bind actual laptop");
  expect(ui).toContain('data-founder-device-recovery');
  expect(ui).toContain("reviewer_can_attest");
  expect(ui).toContain("approver_can_sign");
  expect(ui).toContain("company_managed");
  expect(ui).toContain("no_compromise");
  expect(ui).toContain("management_evidence");
  expect(ui).toContain("The reviewer cannot approve the same review");
 });
 it("shows REVOKED accurately and never binds an unapproved browser",()=>{
  expect(binder).toContain('"REVOKED"');
  expect(binder).toContain('device.trust_state==="REVOKED"?"Revoked":"Pending"');
  expect(binder).toContain("kravia-office-device-recovery-approved");
  expect(binding).toContain('registered.trust_state!=="TRUSTED"');
  expect(binding).toContain('registered.company_managed!==true');
  expect(parent).toContain('row.trust_state==="TRUSTED"');
  expect(parent).toContain("COMPLIANT requires all security controls verified and compromise set to NO");
 });
});
