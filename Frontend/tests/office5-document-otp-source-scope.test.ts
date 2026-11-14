import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const service=readFileSync(new URL("../lib/office/document-studio-server.ts",import.meta.url),"utf8");
describe("Document OTP approval receipt scope",()=>{
 it("uses the current source-filtered instance set",()=>{
  expect(service).toContain('const otpInstanceIds=visibleInstances.map(row=>String(row.id))');
  expect(service).toContain('.in("document_instance_id",otpInstanceIds)');
  expect(service).toContain("ownerSigningReviewer && companyInstance.allowed ? otpQuery : otpQuery.eq");
  expect(service).not.toContain("ownerOverride?otpQuery");
 });
 it("keeps signer coordinates out of other actors' results",()=>{
  expect(service).toContain('otpQuery.eq("signer_user_id", current.identity.userId)');
  expect(service).toContain("otp_approvals: otpApprovals.data ?? []");
 });
});