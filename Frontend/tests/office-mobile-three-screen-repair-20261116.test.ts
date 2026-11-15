import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const read=(name:string)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const home=read("components/office-connect-mobile-home.tsx");
const css=read("app/office/office-enterprise-contrast-and-boundaries-20261115.css");
const actions=read("components/office-connect-message-actions.tsx");
const actionCss=read("components/office-connect-message-actions.module.css");
const vault=read("components/office-vault-secret-locker.tsx");
const secret=read("lib/office/vault-secret-server.ts");
const route=read("app/api/office-vault/secrets/route.ts");
describe("KRAVIA Office three iPhone screenshot repairs",()=>{
 it("has a bounded mobile chat header, independently scrollable inbox and safe dock",()=>{
  expect(home).toContain("data-connect-mobile-header");
  expect(home).toContain("data-connect-mobile-inbox");
  expect(home).toContain("data-connect-mobile-dock");
  expect(css).toContain('grid-template-columns:40px minmax(0,1fr) 40px!important');
  expect(css).toContain("height:100dvh!important");
  expect(css).toContain("overflow-y:auto!important");
  expect(css).toContain('input:checked+span:nth-of-type(2)>span');
  expect(css).toContain("min-height:54px!important");
  expect(css).toContain("scrollbar-width:none!important");
 });
 it("uses an actual viewport popover rather than a clipped left-edge menu",()=>{
  expect(actions).toContain('createPortal(');
  expect(actions).toContain('ref={floatingRef}');
  expect(actions).toContain('getBoundingClientRect()');
  expect(actions).toContain('window.visualViewport');
  expect(actions).toContain('onClick={()=>void copyText()}');
  expect(actions).toContain('document.addEventListener("pointerdown",outside)');
  expect(actions).toContain('document.addEventListener("keydown",keyboard)');
  expect(actionCss).toContain("position:fixed;z-index:4000");
  expect(actionCss).toContain("max-height:min(74dvh,520px)");
  expect(css).toContain("-webkit-touch-callout:none!important");
 });
 it("does not silently elevate Vault permission after a real managed-device denial",()=>{
  expect(secret).toContain("currentOfficeTrustedDeviceId(current.admin,current.identity.userId)");
  expect(secret).toContain("MANAGED_DEVICE_REQUIRED");
  expect(secret).toContain("SECRET_ACCESS_REQUIRED");
  expect(secret).toContain('linked.data.company_managed!==true');
  expect(secret).toContain('linked.data.trust_state!=="TRUSTED"');
  expect(secret).toContain('if(!mayUpload&&!mayReview&&!mayRead)');
  expect(route).toContain("code:error instanceof SecretLockerError?error.code:undefined");
  expect(vault).toContain('response.status===403');
  expect(vault).toContain('href="/office/devices"');
  expect(vault).toContain('href="/office/it"');
  expect(vault).toContain('href="/office/k-vault/requests"');
  expect(vault).not.toContain("Secret locker authority is not assigned");
 });
});
