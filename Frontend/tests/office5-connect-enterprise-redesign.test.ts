import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const shell=read("components/office-workspace-shell.tsx");
const connect=read("components/office-connect.tsx");
const tool=read("components/office-connect-message-actions.tsx");
const css=read("app/office/office-chat-ux-20261114.css");
const live=read("lib/office/use-office-chat-live.ts");
const attachment=read("lib/office/chat-attachment-server.ts");
const api=read("app/api/office-chat/templates/route.ts");
const sql=read("../Database/supabase/migrations/20261114215001_office_chat_media_and_personal_templates.sql");
const backend=read("../Backend/backend/main.py");

describe("KRAVIA Office 5.0 enterprise Connect screen",()=>{
 it("preserves the collapsed rail's workspace canvas and centered logout",()=>{
  expect(shell).toContain("data-chat-conversation={isChatConversation}");
  expect(css).toContain("grid-column: 2 !important");
  expect(css).toContain("grid-row: 1 !important");
  expect(css).toContain(".workspace-signout");
  expect(css).toContain("place-items: center !important");
  expect(css).not.toContain("background:#102720");
 });
 it("gives thread conversation the full work area and a contained mobile composer",()=>{
  for(const token of ["data-thread={!!activeId}","data-chat-list","data-chat-body",
    "data-chat-timeline","data-chat-composer","data-chat-thread-header"]){
   expect(connect).toContain(token);
  }
  expect(css).toContain('data-chat-conversation="true"');
  expect(css).toContain('office5-mobile-dock');
  expect(css).toContain("env(safe-area-inset-bottom,0px)");
  expect(css).toContain("data-chat-composer] textarea");
 });
 it("has direct scoped @ member autocomplete, keyboard controls and no standalone mention button",()=>{
  expect(connect).toContain("mentionSuggestions");
  expect(connect).toContain("person.display_name.toLocaleLowerCase()");
  expect(connect).toContain("chooseMention(person:Member)");
  expect(connect).toContain('mention_user_ids:pickedMentions');
  expect(connect).toContain('event.key==="ArrowDown"');
  expect(connect).toContain('event.key==="Tab"');
  expect(connect).not.toContain("@ Mention participant");
 });
 it("keeps messages source-confirmed and idempotent despite optimistic progress UI",()=>{
  expect(connect).toContain("setPendingMessage(");
  expect(connect).toContain("client_nonce:sendingNonce");
  expect(connect).toContain("if(!confirmed.message_id)");
  expect(connect).toContain("nonce.current=null;");
  expect(connect).toContain("Send not confirmed; draft retained");
  expect(connect).toContain("message_id");
 });
 it("has keyboard-only emoji, GIF/media selection and account-scoped reusable templates",()=>{
  expect(connect).toContain('aria-label="Choose emoji"');
  expect(connect).toContain('aria-label="Choose GIF"');
  expect(connect).toContain('aria-label="Message templates"');
  expect(connect).toContain('aria-label="Send message"'.replace("Send message","Send message").slice(0,11));
  expect(connect).toContain('"/api/office-chat/templates"');
  expect(connect).toContain('aria-autocomplete="list"');
  expect(connect).toContain('filePicker.current?.click()');
  expect(connect).toContain('videoPicker.current?.click()');
  expect(connect).toContain("MAX_CHAT_UPLOAD_BYTES");
  expect(tool).toContain("aria-label=\"React to message\"");
 });
 it("keeps private template CRUD behind AAL2 current actor and same-origin writes",()=>{
  expect(api).toContain("requireOfficeActor()");
  expect(api).toContain('workspaceStatus!=="ACTIVE"');
  expect(api).toContain("officeMutationIsSameOrigin(request)");
  expect(api).toContain('.eq("owner_user_id",current.identity.userId)');
  expect(api).toContain("owner_user_id:current.identity.userId");
  expect(sql).toContain("alter table public.office_chat_personal_templates enable row level security");
  expect(sql).toContain("from public,anon,authenticated");
  expect(sql).toContain("to service_role");
 });
 it("recognizes new file signatures but never skips server scanner or source permission",()=>{
  expect(attachment).toContain('MAX_BYTES=4_194_304');
  for(const ext of ["gif:","mp4:","webm:","txt:","docx:","xlsx:"]){
   expect(attachment).toContain(ext);
  }
  expect(attachment).toContain("const type=detect(bytes,input.file.name)");
  expect(attachment).toContain("const type=detect(bytes,attachment.original_filename)");
  expect(attachment).toContain("await scanner(bytes,type.mime)");
  expect(attachment).toContain("requireOfficeChatConversation");
  expect(backend).toContain('"image/gif"');
  expect(backend).toContain('"video/mp4"');
  expect(backend).toContain('"video/webm"');
  expect(sql).toContain("update storage.buckets set");
  expect(sql).toContain("public=false");
 });
 it("does not mistake routine SSE rotations for permanent disconnections",()=>{
  expect(live).toContain("setTimeout");
  expect(live).toContain("4500");
  expect(live).toContain('source.addEventListener("access-revoked"');
  expect(live).toContain('source.addEventListener("ready"');
  expect(live).toContain("changeRef.current()");
 });
});
