import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const route=readFileSync(new URL("../app/api/office-chat/conversations/[id]/events/route.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../../Database/supabase/migrations/202611140015_office_chat_private_realtime.sql",import.meta.url),"utf8");
describe("Office Connect private event streaming",()=>{
 it("requires fresh membership for each event batch, never streaming message payload",()=>{
  expect(route).toContain("await requireOfficeChatConversation(id);");
  expect(route).toContain("MAX_EVENTS_PER_BATCH");
  expect(route).toContain("PULSE_MS");
  expect(route).not.toContain('select("body');
  expect(route).not.toContain("service_role");
  expect(route).toContain("access-revoked");
  expect(route).toContain("controller.desiredSize<=0");
  expect(route).toContain("backpressured=true;break;");
  expect(route).toContain("void (async()=>{");
 });
 it("has bounded streams, cache opt-out and first-party event cursors",()=>{
  expect(route).toContain('maxDuration=30');
  expect(route).toContain('STREAM_MS=24000');
  expect(route).toContain('Content-Type":"text/event-stream; charset=utf-8"');
  expect(route).toContain('Cache-Control":"private, no-store, no-transform"');
  expect(route).toContain('last-event-id');
 });
 it("denies browser SQL and never emits document/file content",()=>{
  expect(migration).toContain("enable row level security");
  expect(migration).toContain("from public,anon,authenticated");
  expect(migration).toContain("office_chat_live_message");
  expect(migration).toContain("office_chat_live_member");
  expect(migration).toContain("office_chat_live_reaction");
 });
});
