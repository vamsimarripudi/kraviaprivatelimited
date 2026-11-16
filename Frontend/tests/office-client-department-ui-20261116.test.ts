import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const shell=read("components/office-workspace-shell.tsx");
const palette=read("components/office-command-palette.tsx");
const handover=read("components/office-department-handover.tsx");
const ownRoute=read("app/api/office-my-departments/route.ts");
const css=read("app/office/office-client-departments.css");
const layout=read("app/office/layout.tsx");
describe("Client-only KRAVIA assigned-department workspace UI",()=>{
 it("uses a lightweight authenticated own-department endpoint while retaining handover separately",()=>{
  expect(shell).toContain('fetch("/api/office-my-departments"');
  expect(ownRoute).toContain("requireOfficeActor()");
  expect(ownRoute).not.toContain("office_department_transfer_requests");
  expect(shell).toContain('officeAssignedDepartmentCodes(snapshot,identity.userId,identity.department)');
  expect(shell).toContain('loadedActor===identity.userId');
  expect(shell).toContain('departmentLoad==="ready"');
  expect(shell).toContain('officeClientSectionVisible(slug,visibleDepartments,isFounder)');
 });
 it("does not expose unrelated operational sections while permissions load or fail",()=>{
  expect(shell).toContain('setAssignedCodes([])');
  expect(shell).toContain('setDepartmentLoad("error")');
  expect(shell).toContain('blockedClientSection');
  expect(shell).toContain('data-office-client-department-guard');
  expect(shell).toContain('Additional department access required');
 });
 it("provides a working department selector and refresh on accepted handover",()=>{
  expect(shell).toContain('data-office-client-departments');
  expect(shell).toContain('onChange={event=>switchActiveDepartment(event.target.value)}');
  expect(shell).toContain('router.push("/office/"+first[0])');
  expect(handover).toContain('window.dispatchEvent(new Event("kravia-office-departments-changed"))');
  expect(shell).toContain('window.addEventListener("focus",refresh)');
 });
 it("only displays search records in visible modules",()=>{
  expect(palette).toContain('remote.filter(result=>');
  expect(palette).toContain('commands.some(command=>pathname===command.href');
 });
 it("has theme-aware styling with no fixed green surfaces",()=>{
  expect(layout).toContain('import "./office-client-departments.css"');
  for(const token of ["--office-ui-ink","--office-ui-control","--office-ui-line",
   "--office-ui-accent","--office-ui-muted","--office-ui-surface"]){
   expect(css).toContain(token);
  }
  expect(css).not.toContain("#22c55e");
  expect(css).toContain("font-size:16px!important");
 });
});
