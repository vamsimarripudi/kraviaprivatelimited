import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const component=readFileSync(new URL("../components/office-connect.tsx",import.meta.url),"utf8");
const hook=readFileSync(new URL("../lib/office/use-office-chat-live.ts",import.meta.url),"utf8");
describe("Connect event stream client and secure fallback",()=>{
 it("only invalidates data; never trusts the event stream for message bodies",()=>{
  expect(hook).toContain('source.addEventListener("change"');
  expect(component).toContain("useOfficeChatLive(activeId,");
  expect(component).toContain('/api/office-chat/conversations/');
  expect(component).toContain('json<MessageResponse>');
  expect(hook).not.toContain("supabase.createClient");
 });
 it("removes live data on authorization revocation and closes background subscriptions",()=>{
  expect(hook).toContain('source.addEventListener("access-revoked"');
  expect(hook).toContain('document.addEventListener("visibilitychange",visibility)');
  expect(hook).toContain('stream?.close()');
  expect(component).toContain("setMessages([]);setMessageScope(null)");
 });
 it("does not advertise presence based on connection creation alone",()=>{
  expect(component).toContain('live==="live"?"Live"');
  expect(component).toContain("data-chat-thread-header");
  expect(hook).toContain("4500");
  expect(hook).toContain('source.addEventListener("ready"');
  expect(hook).toContain("changeRef.current();");
  expect(hook).toContain("Close the initial GET -> stream cursor race");
  expect(component).toContain('},15000)');
 });
});
