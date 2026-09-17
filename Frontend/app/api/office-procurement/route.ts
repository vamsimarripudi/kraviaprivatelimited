import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  addProcurementQuote,
  createProcurement,
  createVendorRenewal,
  getOfficeProcurementOverview,
  issuePurchaseOrder,
  OfficeProcurementError,
  recordProcurementReceipt,
  selectProcurementQuote,
  submitProcurement,
  syncProcurementApproval,
} from "@/lib/office/procurement-server";

const currency = z.string().trim().length(3).transform((value) => value.toUpperCase());
const optionalText = (max: number) => z.string().trim().max(max).optional();
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_REQUEST"),
    owner_user_id: z.string().uuid(),
    department: optionalText(80),
    category: z.enum(["SOFTWARE", "CLOUD", "HARDWARE", "PROFESSIONAL_SERVICE", "OFFICE", "TRAVEL", "MARKETING", "OTHER"]),
    title: z.string().trim().min(3).max(220),
    business_need: z.string().trim().min(3).max(8000),
    quantity: z.number().positive().max(1000000),
    amount_minor: z.number().int().nonnegative(),
    currency,
    required_by: z.string().date().optional(),
    budget_reference: optionalText(500),
    vendor_reference: optionalText(500),
    vendor_name: optionalText(220),
    risk_note: optionalText(4000),
  }),
  z.object({
    action: z.literal("ADD_QUOTE"),
    request_id: z.string().uuid(),
    vendor_reference: optionalText(500),
    vendor_name: z.string().trim().min(2).max(220),
    amount_minor: z.number().int().nonnegative(),
    currency,
    tax_note: optionalText(1000),
    terms: optionalText(4000),
    validity_until: z.string().date().optional(),
    source_reference: z.string().trim().min(3).max(1000),
    comparison_note: optionalText(4000),
  }),
  z.object({ action: z.literal("SELECT_QUOTE"), request_id: z.string().uuid(), quote_id: z.string().uuid(), note: optionalText(4000) }),
  z.object({ action: z.literal("SUBMIT_REQUEST"), request_id: z.string().uuid() }),
  z.object({ action: z.literal("SYNC_APPROVAL"), request_id: z.string().uuid() }),
  z.object({ action: z.literal("ISSUE_PO"), request_id: z.string().uuid(), issue_reference: z.string().trim().min(3).max(1000), terms: optionalText(4000), tax_note: optionalText(1000) }),
  z.object({
    action: z.literal("RECORD_RECEIPT"),
    purchase_order_id: z.string().uuid(),
    status: z.enum(["PARTIAL", "ACCEPTED", "REJECTED"]),
    quantity: z.number().nonnegative().optional(),
    service_period: optionalText(500),
    evidence_reference: z.string().trim().min(3).max(1000),
    note: optionalText(4000),
  }),
  z.object({
    action: z.literal("CREATE_RENEWAL"),
    owner_user_id: z.string().uuid(),
    department: optionalText(80),
    vendor_reference: optionalText(500),
    vendor_name: z.string().trim().min(2).max(220),
    service_name: z.string().trim().min(2).max(220),
    category: z.enum(["SOFTWARE", "CLOUD", "DOMAIN", "EMAIL", "SECURITY", "PROFESSIONAL_SERVICE", "OTHER"]),
    renewal_at: z.string().datetime({ offset: true }),
    notice_at: z.string().datetime({ offset: true }).optional(),
    amount_minor: z.number().int().nonnegative().optional(),
    currency: currency.optional(),
    auto_renew: z.boolean().optional(),
    contract_reference: optionalText(500),
    source_reference: z.string().trim().min(3).max(1000),
  }),
]);

function responseError(error: unknown, fallback: string) {
  const status = error instanceof OfficeProcurementError ? error.status : 500;
  const detail = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    return NextResponse.json(await getOfficeProcurementOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return responseError(error, "Unable to load procurement controls");
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin procurement mutation is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid procurement request" }, { status: 400 });
  try {
    const input = parsed.data;
    let result: unknown;
    switch (input.action) {
      case "CREATE_REQUEST":
        result = await createProcurement({ ownerUserId: input.owner_user_id, department: input.department, category: input.category, title: input.title, businessNeed: input.business_need, quantity: input.quantity, amountMinor: input.amount_minor, currency: input.currency, requiredBy: input.required_by, budgetReference: input.budget_reference, vendorReference: input.vendor_reference, vendorName: input.vendor_name, riskNote: input.risk_note });
        break;
      case "ADD_QUOTE":
        result = await addProcurementQuote({ requestId: input.request_id, vendorReference: input.vendor_reference, vendorName: input.vendor_name, amountMinor: input.amount_minor, currency: input.currency, taxNote: input.tax_note, terms: input.terms, validityUntil: input.validity_until, sourceReference: input.source_reference, comparisonNote: input.comparison_note });
        break;
      case "SELECT_QUOTE": result = await selectProcurementQuote({ requestId: input.request_id, quoteId: input.quote_id, note: input.note }); break;
      case "SUBMIT_REQUEST": result = await submitProcurement(input.request_id); break;
      case "SYNC_APPROVAL": result = await syncProcurementApproval(input.request_id); break;
      case "ISSUE_PO": result = await issuePurchaseOrder({ requestId: input.request_id, issueReference: input.issue_reference, terms: input.terms, taxNote: input.tax_note }); break;
      case "RECORD_RECEIPT": result = await recordProcurementReceipt({ purchaseOrderId: input.purchase_order_id, status: input.status, quantity: input.quantity, servicePeriod: input.service_period, evidenceReference: input.evidence_reference, note: input.note }); break;
      case "CREATE_RENEWAL": result = await createVendorRenewal({ ownerUserId: input.owner_user_id, department: input.department, vendorReference: input.vendor_reference, vendorName: input.vendor_name, serviceName: input.service_name, category: input.category, renewalAt: input.renewal_at, noticeAt: input.notice_at, amountMinor: input.amount_minor, currency: input.currency, autoRenew: input.auto_renew, contractReference: input.contract_reference, sourceReference: input.source_reference }); break;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return responseError(error, "Unable to update procurement controls");
  }
}
