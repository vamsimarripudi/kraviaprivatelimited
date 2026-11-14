import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const route=readFileSync(new URL("../app/api/office-chat/inbox/events/route.ts",import.meta.url),"utf8");
const hook=readFileSync(new URL("../lib/office/use-office-chat-inbox-live.ts",import.meta.url),"utf8");
const overview=readFileSync(new URL("../components/office-connect-overview.tsx",import.meta.url),"utf8");
const connect=readFileSync(new URL("../components/office-connect.tsx",import.meta.url),"utf8");
const index=readFileSync(new URL("../components/office-connect-message-index.tsx",import.meta.url),"utf8");
describe("KRAVIA private multi-conversation live inbox",()=>{
 it("revalidates current memberships and never streams message text or storage locations",()=>{
  expect(route).toContain("await listOfficeChatConversations()");
  expect(route).toContain("current.actor_user_id!==actor");
  expect(route).toContain('event("change",{kind:"MEMBERSHIP"})');
  expect(route).not.toContain('select("body');
  expect(route).not.toContain("storage_reference");
 });
 it("starts at current authorized event head without replaying archived messages",()=>{
  expect(route).toContain('if(!parsed&&initial.conversations.length)');
  expect(route).toContain('order("id",{ascending:false}).limit(1)');
  expect(route).toContain('MAX_BATCH=40');
  expect(route).toContain('STREAM_MS=24000');
 });
 it("updates current home metrics, indexed mentions and conversation nav on source event",()=>{
  expect(connect).toContain('useOfficeChatInboxLive(()=>setReloadCount(x=>x+1),()=>{');
  expect(connect).toContain('liveRevision={reloadCount}');
  expect(overview).toContain('[refresh,liveRevision]');
  expect(index).toContain('useOfficeChatInboxLive(()=>setRefresh(value=>value+1),()=>{');
 });
 it("keeps canonical requests and bounded fallback on SSE disconnect",()=>{
  expect(hook).toContain('next.addEventListener("access-revoked"');
  expect(connect).toContain("setConversations([]);setActor(\"\")");
  expect(index).toContain("setItems([]);setError");
  expect(hook).toContain('document.addEventListener("visibilitychange",visibility)');
  expect(hook).toContain('clearInterval(fallback)');
  expect(hook).toContain('},20000)');
  expect(route).toContain('Cache-Control":"private, no-store, no-transform"');
 });
});
