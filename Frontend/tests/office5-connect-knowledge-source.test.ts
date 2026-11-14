import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const route=readFileSync(new URL("../app/office/(workspace)/chat/[...segments]/page.tsx",import.meta.url),"utf8");
const view=readFileSync(new URL("../components/office-connect-knowledge.tsx",import.meta.url),"utf8");
describe("Connect published knowledge remains source-owned",()=>{
 it("uses a dedicated knowledge route without new approval or publishing engines",()=>{
  expect(route).toContain('return <OfficeConnectKnowledge articleId={segments[2]}/>');
  expect(view).toContain('"/api/office-knowledge"');
  expect(view).not.toContain('method:"POST"');
  expect(view).not.toContain("dangerouslySetInnerHTML");
 });
 it("exposes only current published articles and matching published version bytes",()=>{
  expect(view).toContain('a.status==="PUBLISHED"');
  expect(view).toContain('v.version===selected.current_version&&v.status==="PUBLISHED"');
  expect(view).toContain("Published article unavailable");
 });
 it("preserves current source and ticket authority for actions",()=>{
  expect(view).toContain('credentials:"same-origin"');
  expect(view).toContain('permissions.includes("it.service.request")');
  expect(view).toContain('href="/office/knowledge"');
 });
});
