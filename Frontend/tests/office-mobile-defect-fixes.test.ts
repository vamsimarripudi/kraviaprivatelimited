import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read = (path:string) =>
  readFileSync(new URL("../" + path,import.meta.url),"utf8");
const shell=read("components/office-workspace-shell.tsx");
const officeLayout=read("app/office/layout.tsx");
const financeLayout=read("app/finance/layout.tsx");
const css=read("app/office/office-mobile-repair-20261115.css");
const presenceCss=read("components/office-presence-control.module.css");
const presence=read("components/office-presence-control.tsx");
const signout=read("components/workspace-sign-out-button.tsx");

describe("KRAVIA mobile drawer, sign-out and Workforce Status repairs",()=>{
 it("shows short mobile labels without removing full accessible navigation names",()=>{
  expect(shell).toContain("mobileCategoryLabels");
  expect(shell).toContain('"My work": "Work"');
  expect(shell).toContain('Administration: "Admin"');
  expect(shell).toContain('aria-label={name}');
  expect(shell).toContain('className="office-category-full-label"');
  expect(shell).toContain('className="office-category-compact-label"');
  expect(shell).toContain('window.matchMedia("(max-width: 767px)").matches');
  expect(css).toContain('width: min(308px, 86vw) !important');
  expect(css).toContain('grid-template-columns: 56px minmax(0, 1fr)');
  expect(css).toContain('.office-category-full-label');
  expect(css).toContain('.office-category-compact-label');
 });
 it("centers all sidebar footer actions and the actual sign-out svg",()=>{
  expect(shell).toContain('className="office-sidebar-footer"');
  expect(shell).toContain('<WorkspaceSignOutButton workspace={workspace} iconOnly/>');
  expect(signout).toContain('className="workspace-signout"');
  expect(signout).toContain('<LogOut aria-hidden="true" />');
  expect(css).toContain('button.workspace-signout');
  expect(css).toContain('place-items: center !important');
  expect(css).toContain('justify-items: center !important');
  expect(css).toContain('grid-auto-rows: 44px !important');
  expect(css).toContain('width: 44px !important');
  expect(css).toContain('height: 44px !important');
  expect(css).toContain('transform: none !important');
 });
 it("keeps Workforce Status centered and anchors actions inside its dialog",()=>{
  expect(presence).toContain('createPortal(<dialog');
  expect(presence).toContain('data-office-presence-dialog="true"');
  expect(presence).toContain('data-office-presence-actions="true"');
  expect(presence).toContain('ref={menuRef}');
  expect(presence).toContain('aria-label="Close workforce status"');
  expect(presence).toContain('"/api/office-presence"');
  expect(presence).toContain('"/api/office-attendance"');
  expect(presenceCss).toContain('.actionsMenu { position: static !important; }');
  expect(css).toContain('dialog[data-office-presence-dialog][open]');
  expect(css).toContain('details[data-office-presence-actions] > div');
  expect(css).toContain('right: 14px !important');
  expect(css).toContain('left: auto !important');
  expect(css).toContain('max-width: calc(100% - 28px) !important');
 });
 it("applies one last shared stylesheet without altering Connect home design",()=>{
  expect(officeLayout).toContain('import "./office-mobile-repair-20261115.css"');
  expect(financeLayout).toContain('import "../office/office-mobile-repair-20261115.css"');
  expect(officeLayout.indexOf("office-mobile-repair-20261115.css"))
    .toBeGreaterThan(officeLayout.indexOf("office-connect-mobile-reference.css"));
  expect(css).toContain('@media (max-width: 767px)');
  expect(css).not.toContain("data-connect-mobile-home");
 });
});
