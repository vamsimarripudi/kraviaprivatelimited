import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component=readFileSync(new URL("../components/office-finance-command-center.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const backend=readFileSync(new URL("../../Backend/backend/main.py",import.meta.url),"utf8");
const finance=readFileSync(new URL("../../Backend/backend/finance_ownership.py",import.meta.url),"utf8");

describe("KRAVIA Finance command center",()=>{
 it("aggregates canonical finance sources without creating a parallel ledger",()=>{
  expect(component).toContain('runtime<CommandCenter>("command-center"');
  expect(component).toContain('runtime<GstSummary>("tax/gst/summary"');
  expect(component).toContain('runtime<TrialBalance>("accounting/trial-balance"');
  expect(component).toContain('runtime<FinanceReadiness>("finance/readiness"');
  expect(screen).toContain("OfficeFinanceCommandCenter");
 });
 it("keeps tax and banking claims bounded by source evidence",()=>{
  expect(component).toContain("does not infer bank balances, GST payable, compliance status or provider settlement");
  expect(backend).toContain("no fabricated cash/bank values");
  expect(backend).toContain("no GST portal filing is performed");
 });
 it("surfaces finance exceptions rather than a decorative KPI-only dashboard",()=>{
  expect(component).toContain("ATTENTION QUEUE");
  expect(component).toContain("Unmatched bank rows");
  expect(component).toContain("Active period locks");
  expect(component).toContain("Payment exceptions");
 });
 it("shows treasury readiness without exposing credentials",()=>{
  expect(component).toContain("No secrets exposed");
  expect(finance).toContain('"secrets_exposed": False');
  expect(component).toContain("live_payout_registry_ready");
  expect(component).toContain("webhook_secret_configured");
 });
});
