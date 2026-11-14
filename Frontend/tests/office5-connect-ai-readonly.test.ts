import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const router=readFileSync(new URL("../app/office/(workspace)/chat/[...segments]/page.tsx",import.meta.url),"utf8");
const view=readFileSync(new URL("../components/office-connect-ai-workspace.tsx",import.meta.url),"utf8");
describe("KRAVIA Connect AI only exposes approved source governance",()=>{
 it("routes to dedicated permission-scoped AI policy instead of a fabricated chat agent",()=>{
  expect(router).toContain('if(path==="ai")return <OfficeConnectAiWorkspace/>;');
  expect(view).toContain('fetch("/api/office-ai-governance"');
  expect(view).not.toContain("dangerouslySetInnerHTML");
  expect(view).not.toContain("method:\\"POST\\"");
 });
 it("shows only approved, nonexpired tools and current actor's own requests",()=>{
  expect(view).toContain('item.status==="APPROVED"');
  expect(view).toContain('item.requester_user_id===model?.actor.user_id');
  expect(view).toContain("No prompts, employee records or company documents are transmitted");
 });
 it("does not imply company permission or external execution from approvals",()=>{
  expect(view).toContain('href="/office/ai"');
  expect(view).toContain("This view does not create an external provider session");
  expect(view).toContain("Approved providers");
 });
});
