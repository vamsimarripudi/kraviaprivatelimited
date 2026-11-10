/**
 * Build a compact one-page wage statement for the EXISTING KRAVIA document
 * renderer. Call only with an immutable issued, approved payroll snapshot.
 * PAID means independently verified bank evidence equals the full net salary.
 * Never take this input from a browser-supplied body.
 */
export type WageSlipSnapshot = {
  company_name: string; cin: string; employee_name: string; employee_id: string;
  period_code: string; period_start: string; period_end: string; currency: string;
  monthly_gross_minor: number; annual_ctc_minor: number;
  base_gross_minor: number; additional_earnings_minor: number;
  gross_earned_minor: number; deductions_minor: number; net_pay_minor: number;
  calculation_hash: string; issued_at: string;
};
export type VerifiedBankCredit = { amount_minor: number; credited_at: string; masked_bank_reference: string };
export function formatRupees(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error("Invalid monetary amount");
  return "INR " + (minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function salaryStatementStatus(input: { netMinor: number; credits: readonly VerifiedBankCredit[]; dueDate: string; today: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.today)) throw new Error("Invalid dates");
  const total = input.credits.reduce((n, c) => n + c.amount_minor, 0);
  if (total < 0 || total > input.netMinor || !Number.isSafeInteger(total)) throw new Error("Invalid verified bank credits");
  const outstandingMinor = input.netMinor - total;
  const paymentStatus = outstandingMinor === 0 ? "PAID" : total > 0 ? "PARTIALLY PAID" :
    input.today > input.dueDate ? "UNPAID / UNVERIFIED AFTER DUE DATE" : "AWAITING VERIFIED PAYMENT";
  return { paymentStatus, confirmedMinor: total, outstandingMinor };
}
export function salarySlipDocument(input: {
  code: string; snapshot: WageSlipSnapshot; credits: readonly VerifiedBankCredit[]; dueDate: string; today: string;
}) {
  const { code, snapshot: s, credits, dueDate, today } = input;
  if (s.currency !== "INR" || !/^[A-Za-z0-9_-]{6,160}$/.test(code) || !s.calculation_hash) {
    throw new Error("Verified KRAVIA INR payslip snapshot required");
  }
  const values = [
    s.monthly_gross_minor, s.annual_ctc_minor, s.base_gross_minor, s.additional_earnings_minor,
    s.gross_earned_minor, s.deductions_minor, s.net_pay_minor,
  ].map(Number);
  values.forEach(v => formatRupees(v));
  if (values[2] + values[3] !== values[4] || values[4] - values[5] !== values[6]) {
    throw new Error("Issued payroll snapshot fails earnings reconciliation");
  }
  const state = salaryStatementStatus({ netMinor: values[6], credits, dueDate, today });
  const rows = [
    ["EARNINGS / DEDUCTIONS", "AMOUNT"],
    ["Approved regular earnings", formatRupees(values[2])],
    ["Approved additional earnings (includes OT, if any)", formatRupees(values[3])],
    ["Gross earned", formatRupees(values[4])],
    ["Approved lawful deductions", formatRupees(values[5])],
    ["NET WAGES PAYABLE", formatRupees(values[6])],
    ["Independently verified bank credits", formatRupees(state.confirmedMinor)],
    ["OUTSTANDING / UNVERIFIED BALANCE", formatRupees(state.outstandingMinor)],
  ];
  return {
    document_code: code,
    title: s.company_name + " | Wage Slip | " + s.period_code,
    output_format: "PDF",
    design_schema: {
      page_size: "A4", font_size: 9, margins_mm: { left: 16, right: 16, top: 16, bottom: 16 },
      watermark: "CONFIDENTIAL", footer_text: "PRIVATE EMPLOYEE RECORD | KRAVIA PRIVATE LIMITED | CIN: " + s.cin,
    },
    content_schema: [
      { type: "heading", level: 2, text: s.company_name },
      { type: "paragraph", text: "CIN: " + s.cin + " | CONFIDENTIAL EMPLOYEE PAY RECORD" },
      { type: "heading", level: 1, text: "SALARY SLIP / WAGE STATEMENT" },
      { type: "key_value", items: [
        { label: "Employee", value: s.employee_name },
        { label: "Employee ID", value: s.employee_id },
        { label: "Wage period", value: s.period_start + " to " + s.period_end },
        { label: "Slip reference", value: code },
        { label: "Issue timestamp", value: s.issued_at },
        { label: "Annual gross reference", value: formatRupees(values[1]) },
        { label: "Monthly gross reference", value: formatRupees(values[0]) },
        { label: "Company target due date", value: dueDate },
      ] },
      { type: "table", header: true, rows },
      { type: "key_value", items: [
        { label: "Payment status", value: state.paymentStatus },
        { label: "Verified credit count", value: String(credits.length) },
        { label: "Payroll calculation reference", value: s.calculation_hash.slice(0, 24) },
      ] },
      { type: "paragraph", text: "Payment classification reflects only independently reviewed settlement records. A prepared salary batch is NOT bank payment. If money was transferred but has not yet been verified, the balance remains unverified rather than falsely marked PAID." },
      { type: "paragraph", text: "This wage statement records approved earned wages. An unpaid or partly paid balance remains payable, with any additional contractual relief tracked separately. Contact the authorised company director for correction requests." },
    ],
  } as const;
}
