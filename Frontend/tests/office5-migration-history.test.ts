import {createHash} from "node:crypto";
import {readFileSync,readdirSync} from "node:fs";
import {describe,it,expect} from "vitest";
const folder=new URL("../../Database/supabase/migrations/",import.meta.url);
const paths=readdirSync(folder).filter(file=>file.startsWith("20261114")&&file.endsWith(".sql")).sort();
const content=(name:string)=>readFileSync(new URL(name,folder));
const md5=(buf:Buffer)=>createHash("md5").update(buf).digest("hex");
const applied:Readonly<Record<string,string>>={
 "20261114102312_office_department_handover_access_sync_20261114.sql":"01d8635ea28d1d707befbd140c570eb4",
 "20261114110233_office_document_email_otp_approval_20261114.sql":"1025386c49756ce43fe3ceeea39deb0e",
 "20261114120547_hr_hours_payroll_revision_guards_20261114.sql":"268eae6c6bc9097fd92d446841856214",
 "20261114120559_hr_payroll_independent_review_20261114.sql":"5c18e7d9722337c4d09247eaf6c82f58",
 "20261114120612_hr_leave_evidence_20261114.sql":"7db886381bf5628816b7c01c0d3b8a3b",
 "20261114120622_hr_payroll_maker_checker_20261114.sql":"0d9c7692a9a09d44f03a426cdfa72c02",
};
const planned=[
 "office_chat_private_messages",
 "office_chat_private_groups",
 "office_vault_record_access",
 "office_vault_request_withdraw",
 "office_chat_threads_and_search",
 "office_chat_department_channels",
 "office_chat_it_escalations",
 "office_chat_secure_attachments",
 "office_chat_unread_snapshot",
 "office_chat_pinned_messages",
 "office_chat_reactions",
 "office_chat_scope_triggers",
 "office_chat_user_preferences",
 "office_chat_private_realtime",
 "office_chat_private_typing",
 "office_vault_sealed_locker",
 "office_vault_chunked_ingress",
];
describe("Office5 migration-history identity and release ordering",()=>{
 it("preserves all six production-applied November 14 SQL files byte-for-byte",()=>{
  for(const [filename,originalHash] of Object.entries(applied)){
   expect(paths,filename).toContain(filename);
   expect(md5(content(filename)),filename).toBe(originalHash);
  }
 });
 it("defines 17 new Office5 SQL migrations after the already-applied histories",()=>{
  expect(paths).toHaveLength(23);
  const expected=planned.map((name,i)=>
   "2026111413"+String(i+1).padStart(4,"0")+"_"+name+".sql");
  expect(new Set(paths).size).toBe(paths.length);
  expect(paths).toEqual([...Object.keys(applied),...expected].sort());
  expect(paths.every(name=>/^20261114\d{6}_[a-zA-Z0-9_]+\.sql$/.test(name))).toBe(true);
 });
 it("references only existing migration files from Office, Vault, HR and OTP workflows",()=>{
  for(const workflow of [
   "office5-chat-sql.yml","office5-vault-sql.yml","office5-escalation-sql.yml",
   "office-document-otp-db.yml","office-department-handover-authority.yml",
   "hr-payroll-branch-qa.yml",
  ]){
   const source=readFileSync(new URL("../../.github/workflows/"+workflow,import.meta.url),"utf8");
   const references=[...source.matchAll(/Database\/supabase\/migrations\/(20261114\d{6}_[a-zA-Z0-9_]+\.sql)/g)]
    .map(match=>match[1]);
   expect(references.length,workflow).toBeGreaterThan(0);
   for(const reference of references)expect(paths,workflow+" : "+reference).toContain(reference);
  }
 });
});
