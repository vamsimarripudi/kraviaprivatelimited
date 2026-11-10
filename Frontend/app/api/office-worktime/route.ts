import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { officeWorktimeOverview, officeWorktimeAction, importVerifiedWorktimePremiums, OfficeWorktimeError } from "@/lib/office/worktime-payroll-server";

const uuid = z.string().uuid();
const datetime = z.string().datetime({ offset: true });
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SUBMIT"), employeeId: uuid.optional(), sessionId: uuid.optional(),
    startAt: datetime, endAt: datetime,
    breaks: z.array(z.object({ startAt: datetime, endAt: datetime })).max(40).default([]),
    sourceKind: z.enum(["RECORDED_SESSION","HISTORICAL_CORRECTION"]),
    sourceReference: z.string().trim().min(5).max(600), reason: z.string().trim().min(8).max(1000),
  }),
  z.object({ action: z.literal("DECIDE"), caseId: uuid,
    decision: z.enum(["APPROVE","REJECT"]), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("REQUEST_FLEX"), weekMonday: z.string().date(), leaveDate: z.string().date() }),
  z.object({ action: z.literal("DECIDE_FLEX"), flexId: uuid,
    decision: z.enum(["APPROVE","REJECT"]), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("PROPOSE_POLICY"), employeeId: uuid, effectiveFrom: z.string().date(),
    authorityReference: z.string().trim().min(12).max(300) }),
  z.object({ action: z.literal("DECIDE_POLICY"), policyId: uuid, decision: z.enum(["APPROVE","REJECT"]) }),
  z.object({ action: z.literal("IMPORT_PREMIUMS"), periodId: uuid, employeeId: uuid }),
  z.object({ action: z.literal("ISSUE_SLIP"), payrollResultId: uuid }),
  z.object({ action: z.literal("SUBMIT_SETTLEMENT"), payrollResultId: uuid,
    amountMinor: z.number().int().positive(), creditedAt: datetime,
    bankReference: z.string().trim().min(6).max(140), evidenceReference: z.string().trim().min(8).max(500) }),
  z.object({ action: z.literal("DECIDE_SETTLEMENT"), settlementId: uuid, decision: z.enum(["VERIFY","REJECT"]) }),
]);

function err(e: unknown) {
  const status = e instanceof OfficeWorktimeError ? e.status : 500;
  return NextResponse.json({ detail: e instanceof OfficeWorktimeError ? e.message : "Office payroll evidence is unavailable" },
    { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const monthInput = url.searchParams.get("month");
  if (monthInput && !month.safeParse(monthInput).success) return NextResponse.json({ detail: "Invalid month" }, { status: 400 });
  const employee = url.searchParams.get("employee");
  if (employee && !uuid.safeParse(employee).success) return NextResponse.json({ detail: "Invalid employee" }, { status: 400 });
  try {
    return NextResponse.json(await officeWorktimeOverview({ month: monthInput || undefined, employeeUserId: employee || undefined }),
      { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return err(e); }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin worktime changes are prohibited" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid worktime/payroll action" }, { status: 400 });
  try {
    const input = parsed.data;
    const result = input.action === "IMPORT_PREMIUMS"
      ? await importVerifiedWorktimePremiums({ periodId: input.periodId, employeeId: input.employeeId })
      : await officeWorktimeAction(input);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return err(e); }
}
