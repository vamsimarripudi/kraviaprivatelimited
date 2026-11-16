import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const panel=read("components/office-trusted-device-link.tsx");
const identity=read("components/office-device-identity.tsx");
const binder=read("lib/office/device-binding-server.ts");
const route=read("app/api/office-auth/device/route.ts");
const vault=read("lib/office/vault-secret-server.ts");
describe("Founder laptop onboarding preserves actual device trust",()=>{
 it("shows only the current authorized user's records and never approves devices via UI",()=>{
  expect(panel).toContain('fetch("/api/office-auth/device"');
  expect(panel).toContain('device.trust_state==="TRUSTED"&&device.company_managed&&!device.revoked_at');
  expect(panel).toContain('device.trust_state==="PENDING"');
  expect(panel).toContain('method==="POST"');
  expect(panel).toContain('device_id:deviceId');
  expect(panel).toContain('Awaiting security verification');
  expect(panel).not.toContain('office_approve_device');
  expect(identity).toContain('<OfficeTrustedDeviceLink/>');
  expect(identity).toContain('useState<View>("devices")');
 });
 it("does not allow mobile browsers to bind a registered laptop record",()=>{
  expect(binder).toContain('registered.trust_state!=="TRUSTED"');
  expect(binder).toContain('registered.company_managed!==true');
  expect(binder).toContain('registered.revoked_at');
  expect(binder).toContain('"sec-ch-ua-mobile"');
  expect(binder).toContain('/Android|iPhone|iPad|Mobile/i');
  expect(binder).toContain('registered.device_kind');
 });
 it("binds only AAL2 same-origin sessions through hashed first-party cookies",()=>{
  expect(route).toContain("officeMutationIsSameOrigin");
  expect(route).toContain('context.identity.aal !== "aal2"');
  expect(binder).toContain('httpOnly: true');
  expect(binder).toContain('sameSite: "strict"');
  expect(binder).toContain('office_bind_trusted_device');
  expect(binder).toContain('office_validate_device_binding');
  expect(vault).toContain('linked.data.company_managed!==true');
 });
});
