import {describe,it,expect} from "vitest";
import {knowledgeArticleIsManaged,knowledgeArticleIsVisible,type KnowledgeVisibilityContext} from "../lib/office/knowledge-visibility";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../lib/office/knowledge-server.ts",import.meta.url),"utf8");
const scoped:KnowledgeVisibilityContext={
 department:"ENGINEERING",roles:["MEMBER"],companyManage:false,companyPublish:false,
 departmentManage:true,departmentPublish:false,
};
const row=(id:string,status:string,dept:string)=>({id,status,audience_type:"DEPARTMENT",audience_key:dept});
describe("Knowledge Hub department and role confidentiality",()=>{
 it("never reveals other departments' drafts to a department-only manager",()=>{
  expect(knowledgeArticleIsVisible(row("x","DRAFT","FINANCE"),scoped)).toBe(false);
  expect(knowledgeArticleIsVisible(row("y","PUBLISHED","FINANCE"),scoped)).toBe(false);
  expect(knowledgeArticleIsVisible(row("z","DRAFT","ENGINEERING"),scoped)).toBe(true);
  expect(knowledgeArticleIsManaged(row("x","DRAFT","FINANCE"),scoped)).toBe(false);
 });
 it("keeps company-published and role-published knowledge readable",()=>{
  expect(knowledgeArticleIsVisible({id:"company",status:"PUBLISHED",audience_type:"COMPANY"},scoped)).toBe(true);
  expect(knowledgeArticleIsVisible({id:"draft",status:"DRAFT",audience_type:"COMPANY"},scoped)).toBe(false);
  expect(knowledgeArticleIsVisible({id:"role",status:"PUBLISHED",audience_type:"ROLE",audience_key:"MEMBER"},scoped)).toBe(true);
 });
 it("does not grant draft access after a department transfer",()=>{
  expect(knowledgeArticleIsVisible(row("a","DRAFT","ENGINEERING"),{...scoped,department:null})).toBe(false);
 });
 it("keeps company-wide managers authoritative over publication",()=>{
  expect(knowledgeArticleIsVisible(row("legal","DRAFT","LEGAL"),{...scoped,companyManage:true})).toBe(true);
 });
 it("rechecks active assignments and record scope for knowledge edits",()=>{
  expect(source).toContain('current.admin.from("office_job_assignments")');
  expect(source).toContain('await currentDepartment(current)');
  expect(source).toContain('requireKnowledgeWrite(current,"knowledge.manage",input.articleId)');
  expect(source).toContain('requireKnowledgeWrite(current,"knowledge.publish",String(version.data.article_id))');
  expect(source).toContain("editableIds.has");
 });
});
