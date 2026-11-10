import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { getOfficeSessionContext } from "@/lib/office/auth-server";
import { requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { salarySlipDocument, type WageSlipSnapshot, type VerifiedBankCredit } from "@/lib/office/salary-slip-document";
import { targetSalaryDate } from "@/lib/office/worktime-payroll-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const snapshotSchema = z.object({
  company_name: z.literal("KRAVIA PRIVATE LIMITED"),
  cin: z.literal("U62011AP2026PTC126691"),
  employee_name: z.string().min(1), employee_id: z.string().min(1),
  period_code: z.string().min(1),
  period_start: z.string().date(), period_end: z.string().date(),
  currency: z.literal("INR"),
  annual_ctc_minor: z.coerce.number().int().nonnegative().safe(),
  monthly_gross_minor: z.coerce.number().int().nonnegative().safe(),
  base_gross_minor: z.coerce.number().int().nonnegative().safe(),
  additional_earnings_minor: z.coerce.number().int().nonnegative().safe(),
  gross_earned_minor: z.coerce.number().int().nonnegative().safe(),
  deductions_minor: z.coerce.number().int().nonnegative().safe(),
  net_pay_minor: z.coerce.number().int().nonnegative().safe(),
  calculation_hash: z.string().min(8), issued_at: z.string(),
});

function error(status: number, detail: string) {
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return error(400, "Invalid payslip ID");
  try {
    const { admin, identity } = await requireOfficeActor();
    const result = await admin.from("office_salary_payslip_issues")
      .select("id,employee_user_id,payroll_result_id,issue_code,snapshot")
      .eq("id", id).maybeSingle();
    if (result.error) return error(503, "Payslip vault unavailable");
    const issue = result.data;
    if (!issue) return error(404, "Payslip not found");
    if (issue.employee_user_id !== identity.userId) {
      const read = await resolveOfficePermission(admin, identity, "payroll.run.read", { type: "COMPANY" });
      if (!read.allowed) return error(403, "You may download only your own payslips");
    }
    const integrity = await admin.rpc("office_salary_slip_integrity_check", { p_issue: issue.id });
    if (integrity.error || integrity.data !== true) return error(409, "Payslip snapshot integrity verification failed");

    const snapshot = snapshotSchema.safeParse(issue.snapshot);
    if (!snapshot.success) return error(409, "Payslip contains invalid locked earnings data");
    const wageSlip = snapshot.data as WageSlipSnapshot;
    const settled = await admin.from("office_salary_settlement_evidence")
      .select("amount_minor,credited_at,masked_bank_reference")
      .eq("payroll_result_id", issue.payroll_result_id).eq("status", "VERIFIED");
    if (settled.error) return error(503, "Bank reconciliation evidence unavailable");
    const credits: VerifiedBankCredit[] = (settled.data ?? []).map(row => ({
      amount_minor: Number(row.amount_minor), credited_at: row.credited_at,
      masked_bank_reference: row.masked_bank_reference,
    }));
    const month = wageSlip.period_start.slice(0, 7);
    const dueDate = targetSalaryDate(month).date;
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    // Only server-side, locked source data can enter the existing PDF renderer.
    const renderedPayload = salarySlipDocument({
      code: "KPL-PAY-" + id.replaceAll("-", ""),
      snapshot: wageSlip, credits, dueDate, today,
    });
    const origin = getOfficeRuntimeOrigin();
    const session = await getOfficeSessionContext();
    if (!origin || !session?.session.access_token) return error(503, "Private document renderer unavailable");
    const rendered = await fetch(new URL("/api/v1/document-engine/render", origin), {
      method: "POST",
      headers: {
        Authorization: "Bearer " + session.session.access_token,
        "Content-Type": "application/json", Accept: "application/pdf",
        "X-Kravia-Gateway": "private-salary-slip",
      },
      body: JSON.stringify(renderedPayload), cache: "no-store", redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    if (!rendered.ok || !(rendered.headers.get("content-type") || "").includes("application/pdf")) {
      return error(502, "Private payslip PDF render failed");
    }
    const bytes = await rendered.arrayBuffer();
    if (bytes.byteLength < 80 || bytes.byteLength > 2_000_000 ||
        new TextDecoder().decode(bytes.slice(0, 4)) !== "%PDF") {
      return error(502, "Payslip PDF did not pass document integrity checks");
    }
    return new NextResponse(bytes, { status: 200,
      headers: { "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="KRAVIA-Salary-Slip-' + id + '.pdf"',
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return error(503, "Private payslip issuance is unavailable");
  }
}
