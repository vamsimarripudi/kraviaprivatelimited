import { describe, expect, it } from "vitest";
import { salarySlipDocument, salaryStatementStatus, formatRupees, type WageSlipSnapshot } from "../lib/office/salary-slip-document";

const snapshot: WageSlipSnapshot = {
  company_name: "KRAVIA PRIVATE LIMITED", cin: "U62011AP2026PTC126691",
  employee_name: "Example Employee", employee_id: "KPL-EMP-001",
  period_code: "2026-08", period_start: "2026-08-01", period_end: "2026-08-31",
  currency: "INR", annual_ctc_minor: 4_800_0000,
  monthly_gross_minor: 4_000_000,
  base_gross_minor: 4_000_000, additional_earnings_minor: 553_846,
  gross_earned_minor: 4_553_846, deductions_minor: 20_000,
  net_pay_minor: 4_533_846, calculation_hash: "sha256digest",
  issued_at: "2026-09-01T11:00:00Z",
};

describe("KRAVIA issued payslip and unpaid wage statement", () => {
  it("uses the existing PDF document engine's one-page composition blocks", () => {
    const doc = salarySlipDocument({ code: "KPL-PAY-EMP-202608", snapshot, credits: [], dueDate: "2026-08-28", today: "2026-09-01" });
    expect(doc.output_format).toBe("PDF");
    expect(doc.design_schema.watermark).toBe("CONFIDENTIAL");
    expect(doc.content_schema.some(x => x.type === "table")).toBe(true);
    expect(JSON.stringify(doc)).toContain("UNPAID / UNVERIFIED AFTER DUE DATE");
    expect(JSON.stringify(doc)).not.toContain("BANK TRANSFER SUCCESSFUL");
  });

  it("treats zero bank confirmations as unpaid only after the due date", () => {
    const later = salaryStatementStatus({ netMinor: 4_000_000, credits: [], dueDate: "2026-08-28", today: "2026-09-01" });
    expect(later.paymentStatus).toContain("UNPAID");
    expect(later.outstandingMinor).toBe(4_000_000);
    const earlier = salaryStatementStatus({ netMinor: 4_000_000, credits: [], dueDate: "2026-08-28", today: "2026-08-25" });
    expect(earlier.paymentStatus).toBe("AWAITING VERIFIED PAYMENT");
  });

  it("keeps partial salary balances and flags only independently verified full payment as paid", () => {
    const rows = [{ amount_minor: 2_000_000, credited_at: "2026-08-28T12:00:00Z", masked_bank_reference: "XYZ***123" }];
    const partial = salaryStatementStatus({ netMinor: 4_000_000, credits: rows, dueDate: "2026-08-28", today: "2026-09-01" });
    expect(partial.paymentStatus).toBe("PARTIALLY PAID");
    expect(partial.outstandingMinor).toBe(2_000_000);
    const paid = salaryStatementStatus({ netMinor: 4_000_000, credits: [...rows, { ...rows[0], amount_minor: 2_000_000 }], dueDate: "2026-08-28", today: "2026-09-01" });
    expect(paid.paymentStatus).toBe("PAID");
    expect(paid.outstandingMinor).toBe(0);
  });

  it("rejects mismatched immutable payroll snapshots or invented overpayments", () => {
    expect(() => salarySlipDocument({ code: "KPL-PAY-EMP-202608", snapshot: { ...snapshot, net_pay_minor: 8_000_000 }, credits: [], dueDate: "2026-08-28", today: "2026-09-01" })).toThrow(/reconciliation/);
    expect(() => salaryStatementStatus({ netMinor: 10_000, credits: [{ amount_minor: 20_000, credited_at: "2026-08-30T12:00:00Z", masked_bank_reference: "XYZ***123" }], dueDate: "2026-08-28", today: "2026-09-01" })).toThrow();
    expect(formatRupees(40_000)).toBe("INR 400.00");
  });
});
