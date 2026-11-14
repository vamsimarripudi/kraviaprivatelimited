import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const inbox=readFileSync(new URL("../components/office-connect-approvals.tsx",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/office/(workspace)/chat/approvals/page.tsx",import.meta.url),"utf8");
const detail=readFileSync(new URL("../app/office/(workspace)/chat/[...segments]/page.tsx",import.meta.url),"utf8");
const canonical=readFileSync(new URL("../lib/office/workflow-server.ts",import.meta.url),"utf8");
describe("Connect approval and decision-room source authority",()=>{
 it("maps inbox and individual decision room without creating parallel requests",()=>{
  expect(route).toContain("OfficeConnectApprovals");
  expect(detail).toContain("OfficeConnectApprovals requestId={segments[1]}");
  expect(inbox).toContain('"/api/office-work/overview"');
  expect(inbox).not.toContain('"/api/office-chat/approvals"');
 });
 it("only presents steps assigned and pending for this actor",()=>{
  expect(inbox).toContain('step.status==="PENDING"');
  expect(inbox).toContain("step.assigned_user_id===overview.identity.user_id");
  expect(inbox).toContain('Decision unavailable');
 });
 it("does not accept a confirmation without explicit reviewed reason",()=>{
  expect(inbox).toContain('reason.trim().length<12');
  expect(inbox).toContain("!confirmed");
  expect(inbox).toContain("inFlight.current");
  expect(inbox).toContain('method:"PATCH"');
 });
 it("uses the source's maker-checker decision rather than a chat permission",()=>{
  expect(canonical).toContain('admin.rpc("office_decide_request"');
  expect(inbox).toContain("Fulfilment is separately authorized.");
  expect(inbox).toContain("current step");
 });
});
