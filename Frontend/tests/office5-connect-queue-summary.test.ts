import {describe,expect,it} from "vitest";
import {queueGroups,dueQueue,terminalIt,terminalSupport} from "../lib/office/connect-queue-summary";
const now=Date.parse("2026-11-14T12:00:00Z");
const rows=[
 {id:"1",status:"OPEN",priority:"URGENT",category:"NETWORK",owner_user_id:null,due_at:"2026-11-13T12:00:00Z",created_at:"2026-11-11T12:00:00Z"},
 {id:"2",status:"RESOLVED",priority:"HIGH",category:"NETWORK",owner_user_id:"staff",due_at:"2026-11-11T12:00:00Z",created_at:"2026-11-10T12:00:00Z"},
 {id:"3",status:"WAITING_USER",priority:"NORMAL",category:"EMAIL",owner_user_id:"staff",due_at:null,created_at:"2026-11-09T12:00:00Z"},
];
describe("Connect source-only queue insights",()=>{
 it("never invents a due date or breach for unassigned work",()=>{
  const groups=queueGroups(rows,terminalIt,now);
  expect(groups.find(g=>g.name==="NETWORK")).toEqual({
   name:"NETWORK",total:2,active:1,unassigned:1,urgent:1,overdue:1});
  expect(groups.find(g=>g.name==="EMAIL")?.overdue).toBe(0);
 });
 it("lists only active records with source-provided due dates",()=>{
  const due=dueQueue(rows,terminalIt,now);
  expect(due).toHaveLength(1);
  expect(due[0].id).toBe("1");
  expect(due[0].dueState).toBe("PAST DUE");
 });
 it("keeps customer and IT terminal states separate",()=>{
  const pending=[{...rows[0],status:"CANCELLED"}];
  expect(queueGroups(pending,terminalIt,now)[0].active).toBe(0);
  expect(queueGroups(pending,terminalSupport,now)[0].active).toBe(1);
 });
});
