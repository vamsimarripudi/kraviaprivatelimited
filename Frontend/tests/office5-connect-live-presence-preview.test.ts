import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const local=(file:string)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const migration=readFileSync(new URL("../../Database/supabase/migrations/202611160001_office_chat_presence_privacy_and_draft_cancel.sql",import.meta.url),"utf8");
const server=local("lib/office/chat-online-server.ts");
const pulse=local("app/api/office-chat/presence/route.ts");
const roster=local("app/api/office-chat/conversations/[id]/presence/route.ts");
const client=local("lib/office/use-office-chat-online.ts");
const chat=local("components/office-connect.tsx");
const modal=local("components/office-connect-attachment-preview.tsx");
const attachment=local("lib/office/chat-attachment-server.ts");
const discard=local("app/api/office-chat/attachments/[id]/route.ts");
const settings=local("components/office-connect-settings.tsx");
const live=local("app/api/office-chat/conversations/[id]/events/route.ts");
describe("KRAVIA Connect real-time presence & private pre-send media",()=>{
 it("keeps device leases distinct from attendance and does not expose SQL data to browser roles",()=>{
  expect(migration).toContain("office_chat_presence_devices");
  expect(migration).toContain("interval '65 seconds'");
  expect(migration).toContain("enable row level security");
  expect(migration).toContain("from public,anon,authenticated");
  expect(migration).toContain("to service_role");
  expect(migration).not.toContain("grant select on public.office_chat_presence_state to authenticated");
 });
 it("never trusts a browser-supplied sender identity",()=>{
  expect(pulse).toContain("officeMutationIsSameOrigin(request)");
  expect(pulse).toContain("device_id:z.string().uuid()");
  expect(server).toContain("p_actor:current.identity.userId");
  expect(server).toContain("requireOfficeActor()");
  expect(server).not.toContain("p_actor:input.user_id");
 });
 it("provides presence only within a currently authorized conversation",()=>{
  expect(server).toContain("requireOfficeChatConversation(conversationId)");
  expect(server).toContain("getOfficeChatMembers(conversationId)");
  expect(server).toContain('last_seen_visibility!=="NOBODY"');
  expect(server).toContain("showOnline&&active.has(userId)");
  expect(roster).toContain("getOfficeConversationOnlinePresence(id)");
 });
 it("supports configurable last-seen and online visibility through the verified identity",()=>{
  expect(migration).toContain("'COWORKERS','CONVERSATIONS','NOBODY'");
  expect(migration).toContain("'SAME_AS_LAST_SEEN','COWORKERS'");
  expect(settings).toContain("Who can see my last seen?");
  expect(settings).toContain("Who can see when I am online?");
  expect(settings).toContain('method:"PUT"');
  expect(server).toContain("office_chat_presence_set_privacy");
 });
 it("renews and closes each tab lease without using continuous heartbeat in the message path",()=>{
  expect(client).toContain("window.crypto.randomUUID()");
  expect(client).toContain("visibilitychange");
  expect(client).toContain("pagehide");
  expect(client).toContain("setInterval");
  expect(client).toContain("pulse(false)");
 });
 it("adds a sender-only, accessible floating attachment preview",()=>{
  expect(chat).toContain("setFilePreviewOpen(true)");
  expect(chat).toContain("OfficeConnectAttachmentPreview open=");
  expect(chat).toContain("removeSelectedFile(file.key)");
  expect(chat).toContain("composerForm.current?.requestSubmit()");
  expect(modal).toContain('role="dialog" aria-modal="true"');
  expect(modal).toContain("Private draft · Nothing has been sent");
  expect(modal).toContain('files.every(f=>f.status==="available"&&!!f.id)');
  expect(modal).toContain("onMove(file.key");
 });
 it("cancels only unlinked sender-owned attachments and keeps audit evidence",()=>{
  expect(attachment).toContain('kind:"DISCARDED"');
  expect(attachment).toContain('attachment.message_id');
  expect(attachment).toContain('.is("message_id",null)');
  expect(attachment).toContain('status:"CANCELLED"');
  expect(discard).toContain("officeMutationIsSameOrigin(request)");
  expect(migration).toContain("'CANCELLED'");
  expect(migration).toContain("'DISCARDED'");
 });
 it("keeps canonical message read authorization and improves the existing SSE budget",()=>{
  expect(live).toContain("PULSE_MS=700");
  expect(chat).toContain("useOfficeChatLive(activeId,");
  expect(chat).toContain('json<MessageResponse>');
  expect(chat).toContain("lastSeenLabel(");
 });
});
