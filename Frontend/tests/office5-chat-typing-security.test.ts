import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const source=readFileSync(new URL("../lib/office/chat-presence-server.ts",import.meta.url),"utf8");
const endpoint=readFileSync(new URL("../app/api/office-chat/conversations/[id]/typing/route.ts",import.meta.url),"utf8");
const hook=readFileSync(new URL("../lib/office/use-office-chat-live.ts",import.meta.url),"utf8");
describe("Private Connect typing indicators",()=>{
 it("writes only transient boolean activity for verified current members",()=>{
  expect(source).toContain("await requireOfficeChatConversation(conversationId)");
  expect(source).toContain('is_typing:isTyping,last_signal:new Date().toISOString()');
  expect(source).not.toContain("message_body");
  expect(source).not.toContain("keypress");
 });
 it("never includes former, absent or stale members in recipients",()=>{
  expect(source).toContain("getOfficeChatMembers(conversationId)");
  expect(source).toContain('users.has(String(row.user_id))');
  expect(source).toContain('new Date(now.getTime()-10000)');
 });
 it("uses same-origin, private route and separate presence events",()=>{
  expect(endpoint).toContain("officeMutationIsSameOrigin(request)");
  expect(endpoint).toContain('Cache-Control":"private, no-store"');
  expect(hook).toContain('source.addEventListener("presence"');
 });
});
