import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component=readFileSync(new URL("../components/office-payments.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const backend=readFileSync(new URL("../../Backend/backend/finance_ownership.py",import.meta.url),"utf8");
const main=readFileSync(new URL("../../Backend/backend/main.py",import.meta.url),"utf8");

describe("KRAVIA Finance treasury payments",()=>{
  it("uses canonical payment instructions, readiness, approvals and approved expenses",()=>{
    expect(component).toContain('runtime<PaymentInstruction[]>("finance/payment-instructions")');
    expect(component).toContain('runtime<FinanceReadiness>("finance/readiness")');
    expect(component).toContain('runtime<Approval[]>("approvals")');
    expect(component).toContain('runtime<Expense[]>("finance/expenses")');
    expect(screen).toContain("OfficePaymentsWorkspace");
  });

  it("separates payout staging from provider execution",()=>{
    expect(component).toContain("Staging creates a payment instruction and approval request only");
    expect(backend).toContain('@router.post("/finance/payouts", status_code=201)');
    expect(backend).toContain("PAYMENT_INSTRUCTION_APPROVE");
    expect(backend).toContain("Payment instruction must be approved before execution");
  });

  it("keeps execution fail-closed and exposes runtime readiness",()=>{
    expect(backend).toContain('if mode == "disabled": raise HTTPException(409, "Payment execution is disabled")');
    expect(component).toContain("Provider execution is blocked.");
    expect(component).toContain("live_payout_registry_ready");
    expect(component).toContain("live_payout_credentials_configured");
  });

  it("requires explicit confirmation before sandbox or live execution",()=>{
    expect(component).toContain('readiness?.execution_mode === "live" ? "EXECUTE LIVE" : "EXECUTE"');
    expect(component).toContain("LIVE PROVIDER EXECUTION");
    expect(component).toContain("This action can submit a real payout request");
  });

  it("preserves maker-checker separation",()=>{
    expect(component).toContain("The requester cannot decide their own approval");
    expect(main).toContain("Maker-checker control: requester cannot approve own request");
    expect(backend).toContain("Independent maker-checker approval is required");
  });
});
