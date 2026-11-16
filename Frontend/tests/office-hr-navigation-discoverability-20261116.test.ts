import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {capabilityCanAccessSection,navigationCommands} from "../lib/office/workspace-capabilities";
import {officeSections,roleCanAccessSection} from "../lib/office/workspaces";
const shell=readFileSync(new URL("../components/office-workspace-shell.tsx",import.meta.url),"utf8");
describe("HR discoverability without permission elevation",()=>{
 it("exposes an HR category distinct from personal People, Finance and My work",()=>{
  expect(shell).toContain('recruitment:"HR",people:"HR"');
  expect(shell).toContain('manager:"People"');
  expect(shell).toContain('development:"People",worktime:"People"');
  expect(shell).toContain('"My work","HR","People"');
  expect(shell).toContain('HR: "HR"');
  expect(shell).toContain('HR: Users');
  expect(officeSections.people.title).toBe("Employee records");
 });
 it("shows the approved HR director's recruitment entry with low-risk hiring permission",()=>{
  const roles=["DIRECTOR","HR","FINANCE","MEMBER","PRODUCT_ADMIN"] as const;
  expect(roleCanAccessSection(officeSections.recruitment,roles)).toBe(true);
  expect(capabilityCanAccessSection("office","recruitment",roles,["hiring.requisition.read"])).toBe(true);
  expect(capabilityCanAccessSection("office","people",roles,["hiring.requisition.read"])).toBe(false);
  expect(capabilityCanAccessSection("office","people",roles,["people.basic.read"])).toBe(true);
 });
 it("makes HR searchable through existing capability-filtered command results",()=>{
  const commands=navigationCommands("office",[["recruitment",officeSections.recruitment],
    ["people",officeSections.people]]);
  expect(commands.length).toBe(2);
  for(const cmd of commands){
   expect(cmd.keywords).toContain("human resources");
   expect(cmd.keywords).toContain("hr");
   expect(cmd.href).toMatch(/^\/office\//);
  }
 });
 it("only shows related sensitive HR links when they already exist in allowed entries",()=>{
  expect(shell).toContain('entries.some(([slug])=>slug==="payroll")');
  expect(shell).toContain('entries.some(([slug])=>slug==="development")');
  expect(shell).toContain('!entries.some(([slug])=>slug==="people")');
  expect(shell).toContain("Check device approval and permissions");
  expect(shell).toContain('role="status"');
  expect(shell).toContain('capabilityCanAccessSection(workspace, slug, identity.roles, permissions)');
 });
});
