import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  createOfficeSupportCase,
  getOfficeSupportOverview,
  OfficeSupportError,
  requestOfficeSupportRefund,
  transitionOfficeSupportCase,
} from "@/lib/office/support-server";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_CASE"),
    owner_user_id: z.string().uuid(),
    customer_id: optionalText(120),
    product_id: optionalText(120),
    subject: z.string().trim().min(3).max(180),
    description: z.string().trim().min(3).max(8000),
    category: optionalText(80),
    source: z.enum(["EMAIL", "PHONE", "WEB", "INTERNAL", "OTHER"]).optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    due_at: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({
    action: z.literal("TRANSITION_CASE"),
    case_id: z.string().uuid(),
    status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]),
    note: optionalText(4000),
  }),
  z.object({
    action: z.literal("REQUEST_REFUND"),
    case_id: z.string().uuid(),
    amount_minor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    currency: z.string().trim().length(3),
    reason: z.string().trim().min(3).max(2000),
  }),
]);

export async function GET() {
  try {
    return NextResponse.json(await getOfficeSupportOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeSupportError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load support operations";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin support mutation is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid support request" }, { status: 400 });
  try {
    let result: Record<string, unknown>;
    if (parsed.data.action === "CREATE_CASE") {
      result = await createOfficeSupportCase({
        ownerUserId: parsed.data.owner_user_id,
        customerId: parsed.data.customer_id || undefined,
        productId: parsed.data.product_id || undefined,
        subject: parsed.data.subject,
        description: parsed.data.description,
        category: parsed.data.category,
        source: parsed.data.source,
        priority: parsed.data.priority,
        dueAt: parsed.data.due_at,
      });
    } else if (parsed.data.action === "TRANSITION_CASE") {
      result = await transitionOfficeSupportCase({ caseId: parsed.data.case_id, status: parsed.data.status, note: parsed.data.note });
    } else {
      result = await requestOfficeSupportRefund({ caseId: parsed.data.case_id, amountMinor: parsed.data.amount_minor, currency: parsed.data.currency, reason: parsed.data.reason });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeSupportError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to update support operations";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
