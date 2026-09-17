import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  addPayrollAdjustment,
  calculatePayroll,
  createCompensationDraft,
  createPayrollRule,
  getOfficePayrollOverview,
  OfficePayrollError,
  openPayrollPeriod,
  prepareSalaryBatch,
  reviewPayrollAdjustment,
  reviewPayrollRule,
  setPayrollAttendance,
  submitCompensation,
  submitPayroll,
  syncCompensationApproval,
  syncPayrollApproval,
} from "@/lib/office/payroll-server";

const currency = z.string().trim().length(3).transform((value) => value.toUpperCase());
const uuid = z.string().uuid();
const optionalText = (max: number) => z.string().trim().max(max).optional();
const componentSchema = z.object({
  code: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160),
  kind: z.enum(["EARNING", "EMPLOYER_COST", "DEDUCTION", "BENEFIT", "OTHER"]),
  amount_minor: z.number().int().nonnegative().optional(),
  formula: z.string().trim().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_COMPENSATION"), employment_id: uuid, grade: optionalText(80), annual_ctc_minor: z.number().int().nonnegative(), monthly_gross_minor: z.number().int().nonnegative(), currency, components: z.array(componentSchema).max(100).optional(), effective_from: z.string().date(), reason: z.string().trim().min(3).max(2000) }),
  z.object({ action: z.literal("SUBMIT_COMPENSATION"), compensation_id: uuid }),
  z.object({ action: z.literal("SYNC_COMPENSATION"), compensation_id: uuid }),
  z.object({ action: z.literal("CREATE_RULE"), rule_code: z.string().trim().min(2).max(100), kind: z.enum(["COMPANY_POLICY", "PRORATION", "LEAVE", "STATUTORY", "TAX", "BENEFIT", "OTHER"]), title: z.string().trim().min(3).max(220), jurisdiction: z.string().trim().min(2).max(24), effective_from: z.string().date(), effective_to: z.string().date().optional(), configuration: z.record(z.string(), z.unknown()), source_reference: z.string().trim().min(3).max(1000) }),
  z.object({ action: z.literal("REVIEW_RULE"), rule_id: uuid, decision: z.enum(["APPROVE", "REJECT"]), note: optionalText(1000) }),
  z.object({ action: z.literal("OPEN_PERIOD"), kind: z.enum(["MONTHLY", "OFF_CYCLE", "FINAL_SETTLEMENT"]), starts_on: z.string().date(), ends_on: z.string().date(), attendance_cutoff_at: z.string().datetime({ offset: true }).optional(), pay_date: z.string().date().optional() }),
  z.object({ action: z.literal("SET_ATTENDANCE"), period_id: uuid, employment_id: uuid, basis_units: z.number().positive(), payable_units: z.number().nonnegative(), paid_leave_units: z.number().nonnegative().optional(), unpaid_leave_units: z.number().nonnegative().optional(), absence_units: z.number().nonnegative().optional(), unresolved_units: z.number().nonnegative().optional(), source_snapshot: z.record(z.string(), z.unknown()).optional() }),
  z.object({ action: z.literal("ADD_ADJUSTMENT"), period_id: uuid, employment_id: uuid, kind: z.enum(["EARNING", "DEDUCTION", "EMPLOYER_COST"]), code: z.string().trim().min(1).max(80), label: z.string().trim().min(1).max(160), amount_minor: z.number().int().nonnegative(), currency, source_reference: z.string().trim().min(3).max(1000), note: optionalText(2000) }),
  z.object({ action: z.literal("REVIEW_ADJUSTMENT"), adjustment_id: uuid, decision: z.enum(["APPROVE", "REJECT"]) }),
  z.object({ action: z.literal("CALCULATE"), period_id: uuid }),
  z.object({ action: z.literal("SUBMIT_PAYROLL"), period_id: uuid }),
  z.object({ action: z.literal("SYNC_PAYROLL"), period_id: uuid }),
  z.object({ action: z.literal("PREPARE_SALARY_BATCH"), period_id: uuid }),
]);

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof OfficePayrollError ? error.status : 500;
  const detail = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    return NextResponse.json(await getOfficePayrollOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to load payroll controls");
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin payroll mutation is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid payroll request" }, { status: 400 });
  try {
    const input = parsed.data;
    let result: unknown;
    switch (input.action) {
      case "CREATE_COMPENSATION": result = await createCompensationDraft({ employmentId: input.employment_id, grade: input.grade, annualCtcMinor: input.annual_ctc_minor, monthlyGrossMinor: input.monthly_gross_minor, currency: input.currency, components: input.components, effectiveFrom: input.effective_from, reason: input.reason }); break;
      case "SUBMIT_COMPENSATION": result = await submitCompensation(input.compensation_id); break;
      case "SYNC_COMPENSATION": result = await syncCompensationApproval(input.compensation_id); break;
      case "CREATE_RULE": result = await createPayrollRule({ ruleCode: input.rule_code, kind: input.kind, title: input.title, jurisdiction: input.jurisdiction, effectiveFrom: input.effective_from, effectiveTo: input.effective_to, configuration: input.configuration, sourceReference: input.source_reference }); break;
      case "REVIEW_RULE": result = await reviewPayrollRule({ ruleId: input.rule_id, decision: input.decision, note: input.note }); break;
      case "OPEN_PERIOD": result = await openPayrollPeriod({ kind: input.kind, startsOn: input.starts_on, endsOn: input.ends_on, attendanceCutoffAt: input.attendance_cutoff_at, payDate: input.pay_date }); break;
      case "SET_ATTENDANCE": result = await setPayrollAttendance({ periodId: input.period_id, employmentId: input.employment_id, basisUnits: input.basis_units, payableUnits: input.payable_units, paidLeaveUnits: input.paid_leave_units, unpaidLeaveUnits: input.unpaid_leave_units, absenceUnits: input.absence_units, unresolvedUnits: input.unresolved_units, sourceSnapshot: input.source_snapshot }); break;
      case "ADD_ADJUSTMENT": result = await addPayrollAdjustment({ periodId: input.period_id, employmentId: input.employment_id, kind: input.kind, code: input.code, label: input.label, amountMinor: input.amount_minor, currency: input.currency, sourceReference: input.source_reference, note: input.note }); break;
      case "REVIEW_ADJUSTMENT": result = await reviewPayrollAdjustment({ adjustmentId: input.adjustment_id, decision: input.decision }); break;
      case "CALCULATE": result = await calculatePayroll(input.period_id); break;
      case "SUBMIT_PAYROLL": result = await submitPayroll(input.period_id); break;
      case "SYNC_PAYROLL": result = await syncPayrollApproval(input.period_id); break;
      case "PREPARE_SALARY_BATCH": result = await prepareSalaryBatch(input.period_id); break;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to update payroll controls");
  }
}
