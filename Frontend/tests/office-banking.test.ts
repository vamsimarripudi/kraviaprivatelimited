import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component=readFileSync(new URL("../components/office-banking.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const backend=readFileSync(new URL("../../Backend/backend/main.py",import.meta.url),"utf8");
const gateway=readFileSync(new URL("../app/api/office-runtime/[...path]/route.ts",import.meta.url),"utf8");

describe("KRAVIA Finance banking and reconciliation",()=>{
  it("uses canonical masked bank accounts and transactions",()=>{
    expect(component).toContain('runtime<BankAccount[]>("banking/accounts")');
    expect(component).toContain('runtime<BankTransaction[]>("banking/transactions")');
    expect(screen).toContain("OfficeBankingWorkspace");
    expect(backend).toContain("Store only a masked account reference");
  });

  it("keeps bank-side execution outside KRAVIA Office",()=>{
    expect(component).toContain("No bank-side payment execution");
    expect(component).toContain("It does not move money");
    expect(component).toContain("does not imply a live bank connection");
  });

  it("supports deterministic credit auto-match while preserving exceptions",()=>{
    expect(component).toContain("/auto-match");
    expect(component).toContain("REVIEW_REQUIRED");
    expect(backend).toContain("Only credit transactions can currently auto-match customer payments");
    expect(backend).toContain('tx.match_status="REVIEW_REQUIRED"');
  });

  it("routes mutations through the same-origin Office gateway",()=>{
    expect(gateway).toContain("officeMutationIsSameOrigin(request)");
    expect(gateway).toContain('"banking"');
    expect(component).toContain('"Idempotency-Key"');
  });

  it("reuses one governed surface for banking evidence and reconciliation exceptions",()=>{
    expect(component).toContain('type Mode = "banking" | "reconciliation"');
    expect(screen).toContain('mode="banking"');
    expect(screen).toContain('mode="reconciliation"');
  });
});
