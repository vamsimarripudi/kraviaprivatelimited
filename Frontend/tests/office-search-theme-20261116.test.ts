import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const css=read("app/office/office-search-theme-20261116.css");
const paletteCss=read("components/office-command-palette.module.css");
const palette=read("components/office-command-palette.tsx");
const office=read("app/office/layout.tsx");
const finance=read("app/finance/layout.tsx");
const chat=read("components/office-connect-chat-list.tsx");
const settings=read("components/office-settings-hub.tsx");
const mobile=read("components/office-connect-mobile-home.tsx");

describe("KRAVIA Office / Finance adaptive search theme",()=>{
 it("loads final search skin after all legacy styles in both layouts",()=>{
  expect(office).toContain('import "./office-search-theme-20261116.css"');
  expect(finance).toContain('import "../office/office-search-theme-20261116.css"');
  expect(office.indexOf('office-search-theme-20261116.css'))
   .toBeGreaterThan(office.indexOf("office-enterprise-contrast-and-boundaries-20261115.css"));
  expect(finance.indexOf("office-search-theme-20261116.css"))
   .toBeGreaterThan(finance.indexOf("office-enterprise-contrast-and-boundaries-20261115.css"));
 });
 it("uses current Office theme tokens, not the old green/white command-palette chrome",()=>{
  for(const token of ["--office-ui-control","--office-ui-ink","--office-ui-muted",
    "--office-ui-line","--office-ui-surface","--office-ui-surface-alt",
    "--office-ui-accent","--office-ui-ring"]){
   expect(paletteCss).toContain(token);
   expect(css).toContain(token);
  }
  for(const color of ["#275e49","#4d5d55","#edf2ee","#122019","#527565"]){
   expect(paletteCss).not.toContain(color);
  }
  expect(css).toContain("[data-office-global-search]");
  expect(css).toContain("[data-office-search-dialog]");
  expect(css).toContain("[data-office-search-input-row]");
  expect(css).toContain("background:transparent!important");
  expect(css).toContain("color-scheme:inherit");
  expect(css).toContain("input[data-office-search-input]::placeholder");
 });
 it("prevents doubled input borders and draws the focus ring on its wrapper",()=>{
  expect(chat).toContain("data-office-chat-search");
  expect(settings).toContain("data-office-settings-search");
  expect(css).toContain("enterprise-combobox-popover > label");
  expect(css).toContain(":focus-within");
  expect(css).toContain("border:0!important");
  expect(css).toContain("box-shadow:none!important");
  expect(paletteCss).toContain(".inputRow:focus-within");
  expect(paletteCss).toContain("caret-color:var(--office-ui-accent)");
 });
 it("keeps mobile Connect header and navigation coherent when selecting light theme",()=>{
  expect(mobile).toContain("data-connect-mobile-header");
  expect(css).toContain('[data-ui-theme="light"]');
  expect(css).toContain("[data-connect-mobile-header]");
  expect(css).toContain("[data-connect-mobile-tabs]");
  expect(css).toContain("[data-connect-mobile-filters]");
  expect(css).toContain("[data-connect-mobile-dock]");
  expect(css).toContain("font-size:16px!important");
  expect(css).toContain("@media(prefers-reduced-motion:reduce)");
 });
 it("does not show previous results or mislabel a failed search as empty",()=>{
  expect(palette).toContain("remoteFor === normalizedQuery");
  expect(palette).toContain("searchFailed");
  expect(palette).toContain("waitingForRemote");
  expect(palette).toContain('setFailedFor(normalized)');
  expect(palette).toContain("!searchFailed && !waitingForRemote");
  expect(palette).toContain("setSearchRevision(v=>v+1)");
  expect(palette).toContain('role="status"');
  expect(palette).toContain('aria-label="Search KRAVIA Office"');
  expect(palette).toContain("searchRevision");
  expect(palette).toContain("controller.abort()");
 });
});
