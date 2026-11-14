import {describe,expect,it} from "vitest";
import {sourceVisibleDocumentInstances} from "../lib/office/document-source-scope";
const records=[
 {id:"mine",owner_user_id:"actor",template_id:"t-general"},
 {id:"colleague",owner_user_id:"coworker",template_id:"t-general"},
 {id:"unowned",owner_user_id:null,template_id:"t-general"},
 {id:"department",owner_user_id:"coworker",template_id:"t-department"},
];
describe("Document Studio canonical instance authorization",()=>{
 it("own-only reader cannot enumerate colleague, unowned or cross-employee instances",()=>{
  expect(sourceVisibleDocumentInstances(records,"actor",false,true,new Set()).map(r=>r.id)).toEqual(["mine"]);
 });
 it("a document creator or template permission never implicitly permits instance read",()=>{
  expect(sourceVisibleDocumentInstances(records,"actor",false,false,new Set()).map(r=>r.id)).toEqual([]);
 });
 it("department permissions expose only instances attached to verified department templates",()=>{
  expect(sourceVisibleDocumentInstances(records,"actor",false,false,new Set(["t-department"])).map(r=>r.id))
   .toEqual(["department"]);
 });
 it("company read authority covers all instances unless denied by canonical IAM",()=>{
  expect(sourceVisibleDocumentInstances(records,"actor",true,false,new Set()).map(r=>r.id))
   .toEqual(["mine","colleague","unowned","department"]);
 });
 it("stale or revoked department assignment is represented by an empty verified template set",()=>{
  expect(sourceVisibleDocumentInstances(records,"actor",false,false,new Set()).map(r=>r.id)).toEqual([]);
 });
});
