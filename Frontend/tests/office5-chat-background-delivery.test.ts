import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
describe("KRAVIA Connect delivery while in any Office workspace",()=>{
 it("uses only current authorized conversations and never marks read",()=>{
  const server=read("lib/office/chat-server.ts");
  const route=read("app/api/office-chat/delivery/pump/route.ts");
  const hub=read("components/office-notification-hub.tsx");
  expect(server).toContain("listOfficeChatConversations()");
  expect(server).toContain("office_chat_message_deliveries");
  expect(server).toContain('"office_chat_ack_delivery"');
  expect(server).not.toContain('markOfficeChatRead(conversationId,messageIds)');
  expect(route).toContain("officeMutationIsSameOrigin");
  expect(route).toContain("acknowledgeOfficeChatInbox()");
  expect(hub).toContain("/api/office-chat/delivery/pump");
  expect(hub).toContain('document.visibilityState==="visible"');
 });
});
