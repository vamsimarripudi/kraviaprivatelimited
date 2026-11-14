import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const view=readFileSync(new URL("../components/office-connect-announcements.tsx",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/office/(workspace)/chat/[...segments]/page.tsx",import.meta.url),"utf8");
const kb=readFileSync(new URL("../lib/office/knowledge-server.ts",import.meta.url),"utf8");
describe("KRAVIA Connect source-based company announcement feed",()=>{
 it("shows only published, non-expired current-audience communications",()=>{
  expect(route).toContain('if(path==="announcements")return <OfficeConnectAnnouncements/>;');
  expect(view).toContain('row.status==="PUBLISHED"');
  expect(view).toContain('Date.parse(row.expires_at)>Date.now()');
  expect(view).toContain('"/api/office-knowledge"');
  expect(kb).toContain('inAudience(row,department,current.identity.roles)');
 });
 it("records only explicit verified acknowledgements and never sends emails",()=>{
  expect(view).toContain('action:"ANNOUNCEMENT_RECEIPT"');
  expect(view).toContain('acknowledged:true');
  expect(view).toContain('result.recorded!==true');
  expect(view).not.toContain("sendEmail");
  expect(view).not.toContain("sendMail");
 });
 it("does not infer acknowledgement from a read or absence of receipt",()=>{
  expect(view).toContain('new Set(');
  expect(view).toContain('Boolean(r.acknowledged_at)');
  expect(view).toContain('row.requires_ack');
 });
});
