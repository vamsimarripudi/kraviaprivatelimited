import {describe,it,expect} from "vitest";
import {visibleVaultRecordIds} from "../lib/office/vault-record-visibility";
const rows=[
 {id:"owned",owner_user_id:"actor"},
 {id:"other",owner_user_id:"colleague"},
 {id:"company",owner_user_id:null},
];
describe("K-Vault authoritative per-record source scope",()=>{
 it("own-only access never lists a colleague's or unowned company record",()=>{
  expect([...visibleVaultRecordIds(rows,"actor",false,true)]).toEqual(["owned"]);
 });
 it("a category-level Vault grant does not imply any source permission",()=>{
  expect([...visibleVaultRecordIds(rows,"actor",false,false)]).toEqual([]);
 });
 it("company authority can read all current source-owned records",()=>{
  expect([...visibleVaultRecordIds(rows,"actor",true,false)]).toEqual(["owned","other","company"]);
 });
 it("unowned documents are not treated as the current user's records",()=>{
  expect([...visibleVaultRecordIds([{id:"orphan",owner_user_id:null}],"actor",false,true)]).toEqual([]);
 });
 it("an old employee's OWN authority does not transfer to another actor",()=>{
  expect([...visibleVaultRecordIds(rows,"new_actor",false,true)]).toEqual([]);
 });
});
