import {describe,it,expect} from "vitest";
import {
 OFFICE_DEPARTMENT_SECTIONS,officeAssignedDepartmentCodes,
 officeClientSectionVisible,officeClientCategoryForSection,
 officeDepartmentForSection,officeDepartmentLabel,
} from "../lib/office/client-department-navigation";

const founderId="founder",manoharId="ceo",jayaId="coo";
const source={
 actor:{user_id:manoharId},
 departments:[
  {code:"EXECUTIVE",label:"Executive"},{code:"FINANCE",label:"Finance"},
  {code:"PEOPLE",label:"People & HR"},{code:"PRODUCT",label:"Product"},
  {code:"LEGAL",label:"Legal"},{code:"ENGINEERING",label:"Engineering"},
 ],
 ownership:[
  {department_code:"EXECUTIVE",owner_user_id:manoharId},
  {department_code:"FINANCE",owner_user_id:manoharId},
  {department_code:"PEOPLE",owner_user_id:manoharId},
  {department_code:"PRODUCT",owner_user_id:manoharId},
  {department_code:"LEGAL",owner_user_id:jayaId},
 ],
};
describe("Office client-only assigned-department workspace switcher",()=>{
 it("shows only owned departments and own primary department",()=>{
  const codes=officeAssignedDepartmentCodes(source,manoharId,"PRODUCT");
  expect(codes).toEqual(["EXECUTIVE","FINANCE","PEOPLE","PRODUCT"]);
  expect(codes).not.toContain("LEGAL");
  expect(codes).not.toContain("ENGINEERING");
 });
 it("does not trust a department result for the wrong authenticated user",()=>{
  expect(officeAssignedDepartmentCodes(source,founderId,"EXECUTIVE")).toEqual([]);
 });
 it("uses the signed-in primary department for a non-owner without claiming ownership",()=>{
  const scoped={actor:{user_id:jayaId},departments:[],ownership:[]};
  expect(officeAssignedDepartmentCodes(scoped,jayaId,"OPERATIONS")).toEqual(["OPERATIONS"]);
 });
 it("does not expose an unassigned department just because it exists in the catalog",()=>{
  const granted=officeAssignedDepartmentCodes(source,manoharId,"PRODUCT");
  expect(officeClientSectionVisible("engineering",granted,false)).toBe(false);
  expect(officeClientSectionVisible("crm",granted,false)).toBe(false);
  expect(officeClientSectionVisible("people",granted,false)).toBe(true);
  expect(officeClientSectionVisible("payroll",granted,false)).toBe(true);
  expect(officeClientSectionVisible("governance",granted,false)).toBe(false);
 });
 it("keeps personal tools available without company-wide operational access",()=>{
  for(const slug of ["dashboard","my-role","requests","approvals","worktime","settings","it"]){
   expect(officeClientSectionVisible(slug,[],false)).toBe(true);
  }
  expect(officeClientSectionVisible("access",[],false)).toBe(false);
  expect(officeClientSectionVisible("access",[],true)).toBe(true);
 });
 it("separates employee-facing labels and prevents duplicate module assignment",()=>{
  expect(officeDepartmentForSection("recruitment")).toBe("PEOPLE");
  expect(officeDepartmentForSection("payroll")).toBe("FINANCE");
  expect(officeDepartmentLabel("PEOPLE")).toBe("HR");
  expect(officeClientCategoryForSection("recruitment",false)).toBe("HR");
  expect(officeClientCategoryForSection("dashboard",false)).toBe("My work");
  expect(officeClientCategoryForSection("access",true)).toBe("Company control");
  const all=Object.values(OFFICE_DEPARTMENT_SECTIONS).flat();
  expect(all.length).toBe(new Set(all).size);
 });
});
