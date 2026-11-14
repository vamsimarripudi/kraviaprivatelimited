import {describe,expect,it} from "vitest";
import {chatHistoryFilter,compareChatHistory,mergeChatHistory} from "../lib/office/chat-history";
const old={id:"00000000-0000-4000-8000-000000000001",created_at:"2026-11-14T02:30:00.000Z",body:"old"};
const mid={id:"00000000-0000-4000-8000-000000000002",created_at:"2026-11-14T02:31:00.000Z",body:"mid"};
const fresh={id:"00000000-0000-4000-8000-000000000003",created_at:"2026-11-14T02:32:00.000Z",body:"fresh"};
describe("Private Connect history pagination",()=>{
 it("makes a strict keyset cursor including stable ID tie-breaker",()=>{
  const filter=chatHistoryFilter({at:mid.created_at,id:mid.id});
  expect(filter).toContain("created_at.lt."+mid.created_at);
  expect(filter).toContain("id.lt."+mid.id);
 });
 it("rejects a malformed or injected database cursor",()=>{
  expect(()=>chatHistoryFilter({at:"2026-11-14T02:31:00Z),deleted_at.is.null",id:mid.id})).toThrow();
  expect(()=>chatHistoryFilter({at:mid.created_at,id:"evil"})).toThrow();
 });
 it("keeps chronological order across pages and removes overlaps",()=>{
  expect(mergeChatHistory([mid,fresh],[old,mid],"older").map(x=>x.id))
   .toEqual([old.id,mid.id,fresh.id]);
 });
 it("refreshes changed recent messages without losing loaded earlier history",()=>{
  const amended={...mid,body:"edited"};
  expect(mergeChatHistory([old,mid,fresh],[amended,fresh],"latest"))
   .toEqual([old,amended,fresh]);
 });
 it("does not retain text when the latest source window becomes empty",()=>{
  expect(mergeChatHistory([old,mid,fresh],[],"latest")).toEqual([]);
  expect(mergeChatHistory([old,mid,fresh],[fresh],"latest")).toEqual([old,mid,fresh]);
 });
 it("sorts identical timestamps by UUID to keep keyset ordering stable",()=>{
  expect(compareChatHistory({...old,created_at:mid.created_at},mid)).toBeLessThan(0);
 });
});
