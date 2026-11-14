import {describe,expect,it} from "vitest";
import {summarizeSupportCases} from "../lib/office/connect-support-insights";
const now=Date.parse("2026-11-14T12:00:00Z");
const cases=[
 {category:"IT",status:"OPEN",created_at:"2026-11-13T12:00:00Z",due_at:"2026-11-14T11:00:00Z"},
 {category:"SERVICE",status:"RESOLVED",created_at:"2026-11-12T12:00:00Z",
  resolved_at:"2026-11-13T12:00:00Z"},
 {category:"IT",status:"CLOSED",created_at:"2026-11-10T12:00:00Z",
  resolved_at:"2026-11-12T12:00:00Z"},
 {category:"SERVICE",status:"OPEN",created_at:"2026-01-01T00:00:00Z",due_at:null},
];
describe("permission-scoped Customer Support aggregate",()=>{
 it("counts only cases in the selected period and treats due_at as source data",()=>{
  const result=summarizeSupportCases(cases,7,now);
  expect(result.count).toBe(3);
  expect(result.active).toBe(1);
  expect(result.overdue).toBe(1);
  expect(result.median_resolution_hours).toBe(36);
  expect(result.resolution_samples).toBe(2);
 });
 it("never fabricates SLA breach when no due date exists",()=>{
  const result=summarizeSupportCases([{...cases[0],due_at:null}],7,now);
  expect(result.overdue).toBe(0);
 });
 it("provides exactly eight weekly demand buckets and aggregate category counts",()=>{
  const result=summarizeSupportCases(cases,90,now);
  expect(result.weekly).toHaveLength(8);
  expect(result.weekly.reduce((total,row)=>total+row.count,0)).toBe(3);
  expect(result.categories.find(row=>row.name==="IT")?.count).toBe(2);
 });
 it("rejects malformed time data instead of turning it into fake cases",()=>{
  expect(summarizeSupportCases([{...cases[0],created_at:"invalid"}],null,now).count).toBe(0);
 });
});
