import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const officeLayout=read("app/office/layout.tsx");
const financeLayout=read("app/finance/layout.tsx");
const css=read("app/office/office-enterprise-contrast-and-boundaries-20261115.css");
const connected=read("components/office-connect.tsx");
const actions=read("components/office-connect-message-actions.tsx");
const actionStyles=read("components/office-connect-message-actions.module.css");
const chatList=read("components/office-connect-chat-list.tsx");
const thread=read("components/office-connect-thread.tsx");
const worktime=read("components/office-worktime-console.tsx");
const notificationCenter=read("components/office-notification-center.tsx");
const collaboration=read("components/request-collaboration-workspace.tsx");
const mobile=read("components/office-connect-mobile-home.tsx");
const roleInbox=read("components/office-connect-role-inbox.tsx");
const tickets=read("components/office-connect-ticket-conversation.tsx");
const itServer=read("lib/office/it-service-server.ts");
const itAPI=read("app/api/office-it/route.ts");
const supportServer=read("lib/office/support-server.ts");
const supportAPI=read("app/api/office-support/route.ts");
const routes=read("app/office/(workspace)/chat/[...segments]/page.tsx");
const vault=read("app/office/(workspace)/k-vault/[[...segments]]/page.tsx");
const vaultOverview=read("components/office-vault-overview.tsx");
const vaultLoader=read("app/office/(workspace)/k-vault/loading.tsx");
const vaultLocker=read("components/office-vault-secret-locker.tsx");
const vaultServer=read("lib/office/vault-secret-server.ts");
const shell=read("components/office-workspace-shell.tsx");
const workHub=read("components/office-work-hub.tsx");
const oldRole=read("components/internal-workspace-screen.tsx");
const prefetch=read("components/office-prefetch-routes.tsx");

describe("KRAVIA 2026-11-15 unified visual and secured communications repair",()=>{
 it("loads final light/dark and overflow repairs last for Office and Finance",()=>{
  expect(officeLayout).toContain('import "./office-enterprise-contrast-and-boundaries-20261115.css"');
  expect(financeLayout).toContain('import "../office/office-enterprise-contrast-and-boundaries-20261115.css"');
  expect(officeLayout.indexOf("office-enterprise-contrast-and-boundaries-20261115.css"))
    .toBeGreaterThan(officeLayout.indexOf("office-layout-stability-chat-first-20261115.css"));
  expect(financeLayout.indexOf("office-enterprise-contrast-and-boundaries-20261115.css"))
    .toBeGreaterThan(financeLayout.indexOf("office-layout-stability-chat-first-20261115.css"));
  for(const token of ["--office-ui-control","--office-ui-ink","--office-ui-muted","--office-ui-line",
    "--office-ui-surface","--office-ui-surface-alt","--office-ui-accent"]){
    expect(css).toContain(token);
  }
  expect(worktime).toContain('data-office-worktime="true"');
  expect(worktime).toContain('data-worktime-summary="true"');
  expect(notificationCenter).toContain('data-office-notification-center="true"');
  expect(notificationCenter).toContain('data-office-notification-toolbar="true"');
  expect(collaboration).toContain('data-office-request-collab="true"');
  expect(collaboration).toContain('data-office-collab-controls="true"');
  expect(workHub).toContain('data-office-work-toolbar="true"');
  expect(css).toContain('[data-chat-message-line="true"]');
  expect(css).toContain('[data-office-notification-toolbar]');
  expect(css).toContain('[data-office-collab-controls]');
  expect(css).toContain("office-work-hub_toolbar");
  expect(css).toContain("office-worktime-console_summary");
  expect(css).toContain("request-collaboration-workspace_shell");
  expect(css).toContain("office-notification-center_empty");
  expect(css).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
  expect((css.match(/\{/g)||[]).length).toBe((css.match(/\}/g)||[]).length);
 });
 it("removes visible authentication acronyms without removing internal authorization",()=>{
  expect(workHub).not.toContain('AAL2 · authz v');
  expect(workHub).toContain("Verified permissions");
  expect(oldRole).not.toContain("VERIFIED AAL2 SESSION");
  expect(vaultLocker).not.toContain("Verifying AAL2");
  expect(vaultServer).toContain("requireOfficeActor()");
  expect(vaultServer).toContain('version.scan_state!=="CLEAN"||version.review_state!=="APPROVED"');
 });
 it("uses message-centered dates, inline small times, and hidden long-press actions",()=>{
  expect(connected).toContain("messageDay(visibleMessages[index-1].created_at)");
  expect(connected).toContain('role="separator"');
  expect(connected).toContain('time dateTime={message.created_at}>{messageTime(message.created_at)}');
  expect(connected).toContain('onContextMenu={event=>');
  expect(connected).toContain('event.pointerType==="touch"');
  expect(connected).toContain("520");
  expect(connected).toContain("onPointerCancel={cancelMessageHold}");
  expect(connected).toContain("menuOpen={menuFor===message.id}");
  expect(connected).toContain("sentAt={message.created_at}");
  expect(actions).toContain('aria-label="Message actions"');
  expect(actions).toContain("<span>Message details</span>");
  expect(actions).toContain("Delivery ticks appear beside your messages once confirmed.");
  expect(actions).toContain('data-chat-action-menu="true"');
  expect(connected).toContain('data-chat-day-divider="true"');
  expect(connected).toContain('data-chat-message-line="true"');
  expect(thread).toContain("sentAt={message.created_at}");
  expect(thread).toContain('event.pointerType==="touch"');
  expect(actionStyles).toContain("grid-template-columns:1fr");
  expect(css).toContain("border-radius:15px!important");
  expect(css).toContain("data-chat-timeline");
  expect(css).toContain("background-image:radial-gradient");
 });
 it("keeps role-specific ticket inboxes under the original source authorizations",()=>{
  expect(chatList).toContain('<OfficeConnectRoleInbox kind={workspaceMode}/>');
  expect(chatList).toContain('permissions.includes("it.service.manage")');
  expect(chatList).toContain('permissions.includes("support.case.read")');
  expect(mobile).toContain('<OfficeConnectRoleInbox kind={workspaceMode}/>');
  expect(roleInbox).toContain('"/api/office-it"');
  expect(roleInbox).toContain('"/api/office-support"');
  expect(routes).toContain('OfficeConnectTicketConversation kind="it"');
  expect(routes).toContain('OfficeConnectTicketConversation kind="support"');
  expect(tickets).toContain('event_type');
  expect(itAPI).toContain("officeMutationIsSameOrigin");
  expect(itAPI).toContain('z.literal("REPLY_TICKET")');
  expect(supportAPI).toContain("officeMutationIsSameOrigin");
  expect(supportAPI).toContain('z.literal("REPLY_CASE")');
  expect(itServer).toContain("const participant=current.identity.userId");
  expect(itServer).toContain('can(current,"it.service.manage")');
  expect(itServer).toContain('eventQuery.eq("event_type","TICKET_REPLY")');
  expect(itServer).toContain('event_type:"TICKET_REPLY"');
  expect(supportServer).toContain('const write=await writableCase(input.caseId)');
  expect(supportServer).toContain('event_type:"CASE_REPLY"');
  expect(tickets).toContain("Only source-confirmed ticket messages");
 });
 it("preserves encrypted Vault uploads with effective permission and visible loading",()=>{
  expect(vault).toContain('canUpload={allowed.includes("vault.secret.upload")}');
  expect(vaultOverview).toContain("canUpload?");
  expect(vaultOverview).toContain('href="/office/k-vault/secrets"');
  expect(vaultOverview).toContain('href="/office/k-vault/requests"');
  expect(vaultLoader).toContain('aria-busy="true"');
  expect(vaultLocker).toContain('chunkSize=1_048_576');
  expect(vaultServer).toContain('sealVaultContent(data,documentId,versionId,loadVaultKeyring())');
  expect(prefetch).toContain("slice(0, 8)");
  expect(shell).toContain('router.prefetch("/office/k-vault")');
 });
});
