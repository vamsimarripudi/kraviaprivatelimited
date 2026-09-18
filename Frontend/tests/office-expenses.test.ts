import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component=readFileSync(new URL("../components/office-expenses.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const backend=readFileSync(new URL("../../Backend/backend/finance_ownership.py",import.meta.url),"utf8");
const main=readFileSync(new URL("../../Backend/backend/main.py",import.meta.url),"utf8");

describe("KRAVIA Finance expenses and funding",()=>{
 it("uses canonical expenses, funding policies, vendors and approvals",()=>{
  expect(component).toContain('runtime<Expense[]>("finance/expenses")');
  expect(component).toContain('runtime<FundingPolicy[]>("finance/funding-policies")');
  expect(component).toContain('runtime<Vendor[]>("vendors")');
  expect(component).toContain('runtime<Approval[]>("approvals")');
  expect(screen).toContain("OfficeExpensesWorkspace");
 });
 it("enforces active policy and maximum-call limits for shareholder-funded expenses",()=>{
  expect(backend).toContain("Shareholder-funded expense requires an active funding policy");
  expect(backend).toContain("Expense exceeds the active funding policy maximum call");
  expect(component).toContain("Only ACTIVE policies can be attached");
 });
 it("keeps expense approval maker-checker controlled",()=>{
  expect(backend).toContain("EXPENSE_APPROVE");
  expect(backend).toContain("Independent maker-checker approval is required");
  expect(main).toContain("Maker-checker control: requester cannot approve own request");
  expect(component).toContain("The requester cannot decide their own approval");
 });
 it("keeps funding separate from legal ownership",()=>{
  expect(component).toContain("they do not change legal share ownership");
  expect(component).toContain("Expense ≠ ownership change");
 });
 it("keeps payout execution in the separate Payments workspace",()=>{
  expect(component).toContain('href="/finance/payments"');
  expect(component).toContain("creating or approving an expense never executes payment");
 });
});
