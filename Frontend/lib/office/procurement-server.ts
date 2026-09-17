import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";

export class OfficeProcurementError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeProcurementError";
  }
}

type Authority = Awaited<ReturnType<typeof requireOfficeActor>> & { decision: OfficePermissionDecision; department: string | null };

async function actor() {
  try { return await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeProcurementError(error.status, error.message);
    throw error;
  }
}

async function permission(code: string): Promise<Authority> {
  const current = await actor();
  const candidates: OfficeResourceScope[] = [
    ...(current.identity.department ? [{ type: "DEPARTMENT" as const, key: current.identity.department }] : []),
    { type: "COMPANY" },
  ];
  let decision: OfficePermissionDecision | undefined;
  for (const resource of candidates) {
    const next = await resolveOfficePermission(current.admin, current.identity, code, resource);
    if (next.allowed) { decision = next; break; }
    decision = next;
  }
  if (!decision?.allowed) throw new OfficeProcurementError(403, decision?.reason ?? "Procurement permission is required");
  return { ...current, decision, department: decision.source === "OWNER" || decision.scopeType === "COMPANY" ? null : decision.scopeKey || current.identity.department || null };
}

async function can(code: string) {
  try { await permission(code); return true; }
  catch (error) { if (error instanceof OfficeProcurementError && error.status === 403) return false; throw error; }
}

function departmentScope<T>(query: T, department: string | null) {
  if (!department) return query;
  return (query as T & { eq: (column: string, value: string) => T }).eq("department_code", department);
}

export async function getOfficeProcurementOverview() {
  const read = await permission("operations.procurement.read");
  let requestQuery = read.admin.from("office_procurement_requests").select("id,request_code,requester_user_id,owner_user_id,department_code,category,title,business_need,quantity,estimated_amount_minor,currency,required_by,budget_reference,preferred_vendor_reference,preferred_vendor_name,risk_note,status,approval_request_id,selected_quote_id,created_at,updated_at").order("created_at", { ascending: false }).limit(400);
  let renewalQuery = read.admin.from("office_vendor_renewals").select("id,renewal_code,owner_user_id,department_code,vendor_reference,vendor_name,service_name,service_category,renewal_at,notice_at,expected_amount_minor,currency,auto_renew,contract_reference,status,procurement_request_id,source_reference,created_at,updated_at").order("renewal_at", { ascending: true }).limit(400);
  requestQuery = departmentScope(requestQuery, read.department);
  renewalQuery = departmentScope(renewalQuery, read.department);
  const [requests, renewals, people] = await Promise.all([
    requestQuery,
    renewalQuery,
    read.admin.from("office_identity_users").select("user_id,status,display_name,job_title,primary_department").eq("status", "ACTIVE").order("display_name"),
  ]);
  if (requests.error || renewals.error || people.error) throw new OfficeProcurementError(503, "Procurement records are temporarily unavailable");
  const rows = requests.data ?? [];
  const ids = rows.map((row) => String(row.id));
  const approvalIds = rows.map((row) => row.approval_request_id).filter((value): value is string => typeof value === "string");
  const [quotes, purchaseOrders, approvals] = await Promise.all([
    ids.length ? read.admin.from("office_procurement_quotes").select("id,procurement_request_id,vendor_reference,vendor_name,quoted_amount_minor,currency,tax_note,commercial_terms,validity_until,source_reference,comparison_note,selected,recorded_by,created_at,updated_at").in("procurement_request_id", ids).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    ids.length ? read.admin.from("office_purchase_orders").select("id,po_code,procurement_request_id,approval_request_id,selected_quote_id,vendor_reference,vendor_name,amount_minor,currency,tax_note,terms,issue_reference,status,issued_by,issued_at,closed_at,created_at,updated_at").in("procurement_request_id", ids).order("issued_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    approvalIds.length ? read.admin.from("office_requests").select("id,status,priority,current_step_order,due_at,updated_at").in("id", approvalIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (quotes.error || purchaseOrders.error || approvals.error) throw new OfficeProcurementError(503, "Procurement comparisons or approvals are temporarily unavailable");
  const poIds = (purchaseOrders.data ?? []).map((row) => String(row.id));
  const receipts = poIds.length ? await read.admin.from("office_procurement_receipts").select("id,receipt_code,purchase_order_id,acceptance_status,quantity_received,service_period,evidence_reference,note,recorded_by,recorded_at").in("purchase_order_id", poIds).order("recorded_at", { ascending: false }) : { data: [], error: null };
  if (receipts.error) throw new OfficeProcurementError(503, "Procurement receipt evidence is temporarily unavailable");
  const events = ids.length ? await read.admin.from("office_procurement_events").select("id,procurement_request_id,purchase_order_id,renewal_id,actor_user_id,event_type,previous_status,new_status,note,metadata,created_at").or(`procurement_request_id.in.(${ids.join(",")})`).order("created_at", { ascending: false }).limit(800) : { data: [], error: null };
  if (events.error) throw new OfficeProcurementError(503, "Procurement history is temporarily unavailable");
  const [prepare, issuePo, recordReceipt, manageRenewal] = await Promise.all([
    can("operations.procurement.prepare"), can("operations.po.issue"), can("operations.receipt.record"), can("operations.renewal.manage"),
  ]);
  return {
    generated_at: new Date().toISOString(),
    actor: { user_id: read.identity.userId, roles: read.identity.roles, department: read.identity.department ?? null },
    scope: { type: read.decision.scopeType ?? null, key: read.department },
    capabilities: { prepare, issue_po: issuePo, record_receipt: recordReceipt, manage_renewal: manageRenewal },
    people: people.data ?? [],
    requests: rows,
    quotes: quotes.data ?? [],
    purchase_orders: purchaseOrders.data ?? [],
    receipts: receipts.data ?? [],
    renewals: renewals.data ?? [],
    approvals: approvals.data ?? [],
    events: events.data ?? [],
    disclaimer: "Procurement approval, PO issue, receipt evidence and payment are separate controls. This workspace never releases bank payments; payment remains a separate finance maker-checker workflow.",
  };
}

export async function createProcurement(input: { ownerUserId: string; department?: string; category: string; title: string; businessNeed: string; quantity: number; amountMinor: number; currency: string; requiredBy?: string; budgetReference?: string; vendorReference?: string; vendorName?: string; riskNote?: string }) {
  const prepare = await permission("operations.procurement.prepare");
  const department = input.department?.trim() || prepare.identity.department || null;
  if (prepare.department && department !== prepare.department) throw new OfficeProcurementError(403, "Procurement department is outside your scope");
  const { data, error } = await prepare.admin.rpc("office_procurement_create", { p_actor: prepare.identity.userId, p_owner: input.ownerUserId, p_department: department, p_category: input.category, p_title: input.title, p_need: input.businessNeed, p_quantity: input.quantity, p_amount: input.amountMinor, p_currency: input.currency, p_required_by: input.requiredBy ?? null, p_budget: input.budgetReference?.trim() || null, p_vendor_ref: input.vendorReference?.trim() || null, p_vendor_name: input.vendorName?.trim() || null, p_risk: input.riskNote?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeProcurementError(400, error?.message ?? "Unable to create procurement request");
  return { procurement_request_id: data };
}

export async function addProcurementQuote(input: { requestId: string; vendorReference?: string; vendorName: string; amountMinor: number; currency: string; taxNote?: string; terms?: string; validityUntil?: string; sourceReference: string; comparisonNote?: string }) {
  const prepare = await permission("operations.procurement.prepare");
  const { data, error } = await prepare.admin.rpc("office_procurement_add_quote", { p_actor: prepare.identity.userId, p_request: input.requestId, p_vendor_ref: input.vendorReference?.trim() || null, p_vendor_name: input.vendorName, p_amount: input.amountMinor, p_currency: input.currency, p_tax_note: input.taxNote?.trim() || null, p_terms: input.terms?.trim() || null, p_validity: input.validityUntil ?? null, p_source: input.sourceReference, p_comparison: input.comparisonNote?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeProcurementError(400, error?.message ?? "Unable to record quote");
  return { quote_id: data };
}

export async function selectProcurementQuote(input: { requestId: string; quoteId: string; note?: string }) {
  const prepare = await permission("operations.procurement.prepare");
  const { data, error } = await prepare.admin.rpc("office_procurement_select_quote", { p_actor: prepare.identity.userId, p_request: input.requestId, p_quote: input.quoteId, p_note: input.note?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeProcurementError(400, error?.message ?? "Unable to select quote");
  return { quote_id: data };
}

export async function submitProcurement(requestId: string) {
  const prepare = await permission("operations.procurement.prepare");
  const { data, error } = await prepare.admin.rpc("office_procurement_submit", { p_actor: prepare.identity.userId, p_request: requestId });
  if (error || typeof data !== "string") throw new OfficeProcurementError(400, error?.message ?? "Unable to submit purchase request");
  return { approval_request_id: data };
}

export async function syncProcurementApproval(requestId: string) {
  const read = await permission("operations.procurement.read");
  const { data, error } = await read.admin.rpc("office_procurement_sync_approval", { p_actor: read.identity.userId, p_request: requestId });
  if (error || typeof data !== "string") throw new OfficeProcurementError(400, error?.message ?? "Unable to sync purchase approval");
  return { status: data };
}

export async function issuePurchaseOrder(input: { requestId: string; issueReference: string; terms?: string; taxNote?: string }) {
  const issue = await permission("operations.po.issue");
  const { data, error } = await issue.admin.rpc("office_procurement_issue_po", { p_actor: issue.identity.userId, p_request: input.requestId, p_issue_reference: input.issueReference, p_terms: input.terms?.trim() || null, p_tax_note: input.taxNote?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeProcurementError(400, error?.message ?? "Unable to issue purchase order");
  return { purchase_order_id: data };
}

export async function recordProcurementReceipt(input: { purchaseOrderId: string; status: "PARTIAL" | "ACCEPTED" | "REJECTED"; quantity?: number; servicePeriod?: string; evidenceReference: string; note?: string }) {
  const receipt = await permission("operations.receipt.record");
  const { data, error } = await receipt.admin.rpc("office_procurement_record_receipt", { p_actor: receipt.identity.userId, p_po: input.purchaseOrderId, p_status: input.status, p_quantity: input.quantity ?? null, p_service_period: input.servicePeriod?.trim() || null, p_evidence: input.evidenceReference, p_note: input.note?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeProcurementError(400, error?.message ?? "Unable to record receipt");
  return { receipt_id: data };
}

export async function createVendorRenewal(input: { ownerUserId: string; department?: string; vendorReference?: string; vendorName: string; serviceName: string; category: string; renewalAt: string; noticeAt?: string; amountMinor?: number; currency?: string; autoRenew?: boolean; contractReference?: string; sourceReference: string }) {
  const renewal = await permission("operations.renewal.manage");
  const department = input.department?.trim() || renewal.identity.department || null;
  if (renewal.department && department !== renewal.department) throw new OfficeProcurementError(403, "Renewal department is outside your scope");
  const { data, error } = await renewal.admin.rpc("office_renewal_create", { p_actor: renewal.identity.userId, p_owner: input.ownerUserId, p_department: department, p_vendor_ref: input.vendorReference?.trim() || null, p_vendor_name: input.vendorName, p_service: input.serviceName, p_category: input.category, p_renewal_at: input.renewalAt, p_notice_at: input.noticeAt ?? null, p_amount: input.amountMinor ?? null, p_currency: input.currency?.trim() || null, p_auto: input.autoRenew ?? false, p_contract_ref: input.contractReference?.trim() || null, p_source: input.sourceReference });
  if (error || typeof data !== "string") throw new OfficeProcurementError(400, error?.message ?? "Unable to track renewal");
  return { renewal_id: data };
}
