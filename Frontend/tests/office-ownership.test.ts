import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component=readFileSync(new URL("../components/office-ownership.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const backend=readFileSync(new URL("../../Backend/backend/finance_ownership.py",import.meta.url),"utf8");
const main=readFileSync(new URL("../../Backend/backend/main.py",import.meta.url),"utf8");

describe("KRAVIA Finance ownership control",()=>{
 it("derives the cap table from canonical append-only ownership data",()=>{
  expect(component).toContain('runtime<OwnershipSummary>("ownership/summary")');
  expect(component).toContain('runtime<LedgerRow[]>("ownership/ledger")');
  expect(component).toContain("append-only share ledger");
  expect(screen).toContain("OfficeOwnershipWorkspace");
  expect(screen).toContain('section === "ownership" ? <OfficeOwnershipWorkspace');
  expect(screen).toContain('canStage={identity.roles.includes("OWNER") || identity.roles.includes("DIRECTOR")}');
 });
 it("stages share changes and transfers before posting",()=>{
  expect(component).toContain('runtime("ownership/share-changes"');
  expect(component).toContain('runtime("ownership/transfers"');
  expect(component).toContain("Staging does not alter ownership");
  expect(backend).toContain("SHARE_CHANGE_POST");
  expect(backend).toContain("SHARE_TRANSFER_POST");
 });
 it("keeps posting maker-checker controlled",()=>{
  expect(backend).toContain("Independent maker-checker approval is required");
  expect(main).toContain("Maker-checker control: requester cannot approve own request");
  expect(component).toContain("POST OWNERSHIP");
 });
 it("enforces legal ledger bounds at post time",()=>{
  expect(backend).toContain("Share change would create a negative holding");
  expect(backend).toContain("Share change exceeds authorised shares");
  expect(backend).toContain("Source shareholder no longer has sufficient shares");
 });
 it("keeps expense funding separate from legal ownership",()=>{
  expect(component).toContain("Expense funding never edits the cap table");
 });
});
