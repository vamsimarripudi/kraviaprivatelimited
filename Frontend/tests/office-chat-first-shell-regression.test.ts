import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const shell=read("components/office-workspace-shell.tsx");
const signout=read("components/workspace-sign-out-button.tsx");
const clock=read("components/office-ist-clock.tsx");
const connect=read("components/office-connect.tsx");
const desktopChats=read("components/office-connect-chat-list.tsx");
const desktopStyles=read("components/office-connect-chat-list.module.css");
const mobile=read("components/office-connect-mobile-home.tsx");
const flyout=read("components/office-notification-hub.tsx");
const flyoutStyles=read("components/office-notification-hub.module.css");
const stable=read("app/office/office-layout-stability-chat-first-20261115.css");
const officeLayout=read("app/office/layout.tsx");
const financeLayout=read("app/finance/layout.tsx");

describe("KRAVIA Office stable icon rail, notification popover, and chat-first Connect",()=>{
  it("keeps main content in the first flow position even when the sidebar is collapsed",()=>{
    expect(stable).toContain('display:block!important;grid-template-columns:none!important;grid-template-rows:none!important');
    expect(stable).toContain('> .office-mega-aside[data-menu-expanded="false"]');
    expect(stable).toContain('position:fixed!important');
    expect(stable).toContain('grid-area:auto!important');
    expect(stable).toContain('grid-row:auto!important');
    expect(stable).toContain('position:relative!important;top:0!important;bottom:auto!important');
    expect(officeLayout).toContain('import "./office-layout-stability-chat-first-20261115.css"');
    expect(financeLayout).toContain('import "../office/office-layout-stability-chat-first-20261115.css"');
    expect(officeLayout.indexOf("office-layout-stability-chat-first-20261115.css")).toBeGreaterThan(officeLayout.indexOf("office-mobile-repair-20261115.css"));
    expect(financeLayout.indexOf("office-layout-stability-chat-first-20261115.css")).toBeGreaterThan(financeLayout.indexOf("office-mobile-repair-20261115.css"));
  });
  it("keeps the rail icon-only with full names in hover tooltips and accessible labels",()=>{
    expect(shell).toContain("title={name} aria-label={name}");
    expect(stable).toContain(".office-category-full-label,.office-category-compact-label");
    expect(stable).toContain("display:none!important");
    expect(shell).toContain('title="Office settings"');
    expect(shell).toContain("My Chats</OfficeNavLink>");
    expect(shell).not.toContain("Communications</OfficeNavLink>");
    expect(signout).toContain('data-icon-only={iconOnly}');
    expect(signout).toContain('title={pending ? "Signing out" : "Sign out"}');
    expect(stable).toContain('button.workspace-signout[data-icon-only="true"] > svg');
    expect(stable).toContain('transform:translate(-50%,-50%)!important');
  });
  it("keeps the clock in Kolkata timezone without a visible IST suffix",()=>{
    expect(clock).toContain('const zone = "Asia/Kolkata"');
    expect(clock).toContain('title="India Standard Time · Asia/Kolkata"');
    expect(clock).not.toContain('className="office-ist-clock-zone"');
  });
  it("portals notifications out of the narrow topbar trigger",()=>{
    expect(flyout).toContain('createPortal(<div className={styles.flyout}');
    expect(flyout).toContain('ref={flyoutRef} role="dialog"');
    expect(flyout).toContain('document.addEventListener("pointerdown",closeOutside)');
    expect(flyoutStyles).toContain('position:fixed!important');
    expect(flyoutStyles).toContain('width:min(392px,calc(100vw - 24px))!important');
    expect(flyoutStyles).toContain('background:#16191f!important');
  });
  it("uses chat-first search, unread and groups filters, with no KPI dashboard in Connect home",()=>{
    expect(connect).toContain('<OfficeConnectChatList conversations={conversations}');
    expect(connect).toContain('<OfficeConnectWelcome/>');
    expect(connect).not.toContain('<OfficeConnectOverview ');
    expect(desktopChats).toContain("My Chats");
    expect(desktopChats).toContain('"/api/office-chat/unread"');
    expect(desktopChats).toContain('"all","unread","groups"');
    expect(desktopChats).toContain('chatConversationHref(item)');
    expect(desktopChats).toContain('href="/office/chat/directory"');
    expect(desktopStyles).toContain('.chatList');
    expect(stable).toContain('[data-connect-chat-layout]');
    expect(stable).toContain('> [data-chat-list]');
    expect(stable).toContain('> [data-chat-body]');
    expect(mobile).toContain('const [unreadOnly, setUnreadOnly] = useState(false)');
    expect(mobile).toContain("<h1>My Chats</h1>");
  });
});
