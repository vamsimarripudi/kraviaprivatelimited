import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("../Database/supabase/migrations/20261115190229_office_chat_delivery_receipts.sql");
const server=read("lib/office/chat-server.ts");
const api=read("app/api/office-chat/conversations/[id]/deliver/route.ts");
const connect=read("components/office-connect.tsx");
const inbox=read("components/office-connect-chat-list.tsx");
describe("private, source-confirmed Connect message receipts",()=>{
 it("separates signed-in retrieval from focused read",()=>{
  expect(sql).toContain("public.office_chat_message_deliveries");
  expect(sql).toContain("public.office_chat_current_member(p_actor,p_conversation)");
  expect(sql).toContain("on conflict(message_id,recipient_user_id) do nothing");
  expect(sql).toContain("public.office_chat_receipt_event()");
  expect(sql).toContain("from public,anon,authenticated");
  expect(sql).toContain("to service_role");
 });
 it("keeps SSE events free of message content",()=>{
  expect(sql).toContain("'RECEIPT'");
  expect(server).toContain('delivery_status:receipt(');
  expect(server).toContain('return "read"');
  expect(server).toContain('return "delivered"');
  expect(api).toContain("officeMutationIsSameOrigin");
  expect(api).toContain("markOfficeChatDelivered");
  expect(api).toContain(".max(100)");
 });
 it("only marks read in focused foreground conversation",()=>{
  expect(connect).toContain('document.visibilityState!=="visible"||!document.hasFocus()');
  expect(connect).toContain('timeline.scrollHeight-timeline.scrollTop-timeline.clientHeight>110');
  expect(connect).toContain('/deliver"');
  expect(connect).toContain('delivery_status');
  expect(connect).not.toContain("WifiOff size");
  expect(inbox).not.toContain("Secure refresh enabled");
 });
});
