import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read = (path: string) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const home = read("components/office-connect-mobile-home.tsx");
const css = read("components/office-connect-mobile-home.module.css");
const shell = read("components/office-workspace-shell.tsx");
const connect = read("components/office-connect.tsx");
const overrides = read("app/office/office-connect-mobile-reference.css");
const layout = read("app/office/layout.tsx");
const unread = read("lib/office/chat-server.ts");

describe("KRAVIA Connect screenshot-based mobile home", () => {
  it("uses a responsive dark mobile surface without altering desktop or thread UI", () => {
    expect(css).toContain("@media(max-width:767px)");
    expect(css).toContain("background:var(--chat-canvas)");
    expect(overrides).toContain('data-connect-home="true"');
    expect(overrides).toContain('[data-thread="false"]');
    expect(shell).toContain('pathname === "/office/chat"');
    expect(connect).toContain("!activeId ? <OfficeConnectMobileHome");
    expect(layout).toContain('import "./office-connect-mobile-reference.css"');
  });
  it("links to real Connect operations and a single accessible mobile dock", () => {
    for (const route of [
      "/office/chat/search", "/office/chat/saved", "/office/chat/support",
      "/office/chat/directory", "/office/chat/groups/new",
    ]) expect(home).toContain(route);
    expect(home).toContain('role="switch"');
    expect(home).toContain('aria-label="Connect mobile navigation"');
    expect(home).toContain('aria-label="Start a new conversation"');
    expect(home).toContain('kravia-office-open-navigation');
    expect(shell).toContain('window.addEventListener("kravia-office-open-navigation"');
  });
  it("only displays an unread empty state after a verified source response", () => {
    expect(home).toContain("/api/office-chat/unread");
    expect(home).toContain('unreadState === "ready"');
    expect(home).toContain('unreadState === "restricted"');
    expect(home).toContain("No unread messages");
    expect(home).toContain("Unread status unavailable");
    expect(unread).toContain('rpc("office_chat_unread_snapshot"');
    expect(unread).toContain("conversation_id");
  });
});
