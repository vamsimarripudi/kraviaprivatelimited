import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {officeSections} from "../lib/office/workspaces";
const read=(name:string)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const screen=read("components/internal-workspace-screen.tsx");
const excluded=new Set([
 "office-document-otp","office-employee-intake","office-emergency-contacts",
 "office-hr-attendance-import","office-settings-hub","workforce-live-overview",
]);
const imported=[...new Set([...screen.matchAll(/const [A-Za-z0-9_]+ = dynamic\(\(\) => import\("@\/components\/([^"]+)"\)/g)]
 .map(match=>match[1]).filter(name=>name!=="office-nav-link"))];
describe("Office 6 client-only live data for real business sections",()=>{
 it("integrates all 66 safe mounted modules without fake data or server changes",()=>{
  expect(imported).toHaveLength(72);
  let count=0;
  for(const name of imported){
   const source=read("components/"+name+".tsx");
   expect(source,name).toContain('"use client";');
   if(excluded.has(name)){expect(source,name).not.toContain("useOfficeLiveRefresh");continue;}
   expect(source,name).toContain('useOfficeLiveRefresh');
   expect(source,name).toContain("@/lib/office/use-office-live-refresh");
   count++;
  }
  expect(count).toBe(66);
 });
 it("limits network use to visible mounted modules, dedupes bursts, and keeps edits intact",()=>{
  const hook=read("lib/office/use-office-live-refresh.ts");
  expect(hook).toContain('document.visibilityState!=="visible"');
  expect(hook).toContain('Date.now()-last.current<3000');
  expect(hook).toContain('window.setInterval(sync,delay)');
  expect(hook).toContain('window.clearInterval(timer)');
  expect(hook).toContain('closest("form,[role=\'dialog\'],[contenteditable=\'true\']")');
  expect(hook).toContain('kravia-office-live-change');
  expect(read("components/office-notification-hub.tsx"))
   .toContain('new Event("kravia-office-live-change")');
  expect(read("components/workforce-live-overview.tsx")).toContain("15_000");
 });
 it("preserves access isolation and explicitly routed sections",()=>{
  const shell=read("components/office-workspace-shell.tsx");
  expect(shell).toContain("officeClientSectionVisible");
  expect(shell).toContain('fetch("/api/office-departments"');
  expect(read("app/api/office-departments/route.ts")).toContain("requireOfficeActor()");
  for(const slug of Object.keys(officeSections)){
   expect(screen,slug).toContain('section === "'+slug+'"');
  }
 });
 it("uses slower fallback for multi-source finance and security requests",()=>{
  for(const name of ["office-gst-tax","office-accounting","office-banking",
    "office-payments","office-security-overview","office-financial-assurance"]){
   const file=read("components/"+name+".tsx");
   expect(file,name).toMatch(/intervalMs:(?:90000|120000|180000)/);
  }
 });
});
