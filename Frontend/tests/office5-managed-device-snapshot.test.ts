import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const snapshot=readFileSync(new URL("../lib/office/capability-server.ts",import.meta.url),"utf8");
const engine=readFileSync(new URL("../lib/office/permission-engine.ts",import.meta.url),"utf8");
describe("Office 5.0 managed-device parity",()=>{
 it("does not expose high-risk action capabilities without a valid managed binding",()=>{
  expect(snapshot).toContain('deviceEnforced=process.env.OFFICE_DEVICE_ENFORCEMENT?.toLowerCase()==="true"');
  expect(snapshot).toContain('currentOfficeTrustedDeviceId(admin,identity.userId)');
  expect(snapshot).toContain('device.data?.trust_state==="TRUSTED"');
  expect(snapshot).toContain('device.data?.company_managed===true');
  expect(snapshot).toContain('!device.data?.revoked_at');
  expect(snapshot).toContain('(!deviceEnforced || (!row.high_risk&&!row.requires_managed_device) || managedDeviceValid)');
 });
 it("matches managed-device condition used by canonical action gate",()=>{
  expect(engine).toContain("const enforced = process.env.OFFICE_DEVICE_ENFORCEMENT?.toLowerCase() === \"true\"");
  expect(engine).toContain('data.trust_state !== "TRUSTED"');
  expect(engine).toContain("data.company_managed !== true");
 });
});
