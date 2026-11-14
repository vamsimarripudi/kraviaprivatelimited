import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
describe("Office 5.0 Finance and governance action presentation",()=>{
 it("adds effective financial and statutory capability checks to role eligibility",()=>{
  for(const code of [
    "finance.journal.post","finance.bank.read","secretarial.corporate.prepare",
    "secretarial.corporate.approve","audit.read","compliance.instance.manage",
    "tax.gst.approve","security.overview.read",
  ]){
    expect(screen).toContain('permissions.includes("'+code+'")');
  }
 });
 it("does not expose ownership control because of OWNER or DIRECTOR title alone",()=>{
  expect(screen).not.toContain('canStage={(identity.roles.includes("OWNER") || identity.roles.includes("DIRECTOR"))}');
  expect(screen).toContain('canStage={permissions.includes("secretarial.corporate.prepare")');
  expect(screen).toContain('canPost={permissions.includes("secretarial.corporate.approve")');
 });
 it("limits financial assurance and audit verification to currently granted authority",()=>{
  expect(screen).not.toContain("financeReadOnly");
  expect(screen).toContain('canVerifyChain={permissions.includes("audit.read")');
  expect(screen).toContain('canManageCompliance={permissions.includes("compliance.instance.manage")');
  expect(screen).toContain('canSignatory={identity.roles.includes("OWNER") && permissions.includes("tax.gst.approve")');
 });
});
