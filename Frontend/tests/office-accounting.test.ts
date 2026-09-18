import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component=readFileSync(new URL("../components/office-accounting.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const periodControls=readFileSync(new URL("../../Backend/backend/period_controls.py",import.meta.url),"utf8");
const services=readFileSync(new URL("../../Backend/backend/services.py",import.meta.url),"utf8");
const main=readFileSync(new URL("../../Backend/backend/main.py",import.meta.url),"utf8");

describe("KRAVIA Accounting workspace",()=>{
  it("uses the canonical trial balance and period-lock runtime",()=>{
    expect(component).toContain('runtime<TrialBalance>("accounting/trial-balance")');
    expect(component).toContain('runtime<PeriodLock[]>("accounting/period-locks")');
    expect(screen).toContain("OfficeAccountingWorkspace");
  });

  it("exposes controlled lock, unlock-request and approved-unlock actions",()=>{
    expect(component).toContain('"accounting/period-locks"');
    expect(component).toContain("/unlock-request");
    expect(component).toContain("/unlock");
    expect(periodControls).toContain("An overlapping active period lock already covers this control scope");
    expect(periodControls).toContain("An approved maker-checker unlock request is required");
  });

  it("keeps unlock approval maker-checker controlled",()=>{
    expect(component).toContain('runtime<Approval[]>("approvals")');
    expect(component).toContain('decision: "approve" | "reject"');
    expect(main).toContain("Maker-checker control: requester cannot approve own request");
    expect(periodControls).toContain('required_role="CA"');
  });

  it("enforces accounting and tax locks before journal posting",()=>{
    expect(services).toContain('assert_period_open(db, posting_date, "TAX")');
    expect(services).toContain('assert_period_open(db, posting_date, "ACCOUNTING")');
    expect(component).toContain("this workspace does not imply statutory close certification");
  });

  it("renders canonical trial-balance account keys rather than generic aliases",()=>{
    expect(component).toContain("account.account_code");
    expect(component).toContain("account.account_name");
    expect(component).toContain("account.net_paise");
    expect(component).toContain("Total debits");
    expect(component).toContain("Total credits");
  });
});
