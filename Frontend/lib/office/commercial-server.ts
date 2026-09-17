import "server-only";

import { getOfficeCrmOverview, OfficeCrmError } from "@/lib/office/crm-server";
import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";

export class OfficeCommercialError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeCommercialError";
  }
}

type CommercialStage = "CONTRACT" | "SUBSCRIPTION" | "INVOICE";
type Row = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

async function actor() {
  try {
    return await requireOfficeActor();
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeCommercialError(error.status, error.message);
    throw error;
  }
}

async function visibleCrm() {
  try {
    return await getOfficeCrmOverview();
  } catch (error) {
    if (error instanceof OfficeCrmError) throw new OfficeCommercialError(error.status, error.message);
    throw error;
  }
}

function requestStatus(requestMap: Map<string, Row>, id: unknown) {
  const key = text(id);
  return key ? text(requestMap.get(key)?.status) || "UNKNOWN" : "NOT_STARTED";
}

function stageState(requestMap: Map<string, Row>, handoff: Row | null, stage: CommercialStage) {
  if (!handoff) return stage === "CONTRACT" ? "INITIALIZE_REQUIRED" : "LOCKED";
  if (stage === "CONTRACT") return requestStatus(requestMap, handoff.contract_request_id) || "NOT_STARTED";
  if (stage === "SUBSCRIPTION") {
    const contract = requestStatus(requestMap, handoff.contract_request_id);
    if (contract !== "APPROVED") return "LOCKED";
    return requestStatus(requestMap, handoff.subscription_request_id);
  }
  const subscription = requestStatus(requestMap, handoff.subscription_request_id);
  if (subscription !== "APPROVED") return "LOCKED";
  return requestStatus(requestMap, handoff.invoice_request_id);
}

export async function getOfficeCommercialHandoffs() {
  const crm = await visibleCrm();
  const { admin } = await actor();
  const won = (crm.opportunities as Row[]).filter((row) => row.stage === "WON");
  const opportunityIds = won.map((row) => text(row.id)).filter(Boolean);

  const handoffResult = opportunityIds.length
    ? await admin
        .from("office_commercial_handoffs")
        .select("id,opportunity_id,customer_id,product_id,owner_user_id,status,contract_request_id,subscription_request_id,invoice_request_id,created_at,updated_at")
        .in("opportunity_id", opportunityIds)
        .order("updated_at", { ascending: false })
    : { data: [], error: null };
  if (handoffResult.error) throw new OfficeCommercialError(503, "Commercial handoff records are temporarily unavailable");

  const handoffs = (handoffResult.data ?? []) as Row[];
  const requestIds = Array.from(new Set(handoffs.flatMap((row) => [row.contract_request_id, row.subscription_request_id, row.invoice_request_id].map(text).filter(Boolean))));
  const requestsResult = requestIds.length
    ? await admin
        .from("office_requests")
        .select("id,request_type_code,title,status,current_step_order,due_at,submitted_at,completed_at,created_at,updated_at")
        .in("id", requestIds)
    : { data: [], error: null };
  if (requestsResult.error) throw new OfficeCommercialError(503, "Commercial approval status is temporarily unavailable");

  const handoffIds = handoffs.map((row) => text(row.id)).filter(Boolean);
  const eventsResult = handoffIds.length
    ? await admin
        .from("office_commercial_handoff_events")
        .select("id,handoff_id,actor_user_id,event_type,metadata,created_at")
        .in("handoff_id", handoffIds)
        .order("created_at", { ascending: false })
        .limit(300)
    : { data: [], error: null };
  if (eventsResult.error) throw new OfficeCommercialError(503, "Commercial handoff history is temporarily unavailable");

  const requestMap = new Map(((requestsResult.data ?? []) as Row[]).map((row) => [text(row.id), row]));
  const handoffMap = new Map(handoffs.map((row) => [text(row.opportunity_id), row]));
  const eventsByHandoff = new Map<string, Row[]>();
  for (const event of (eventsResult.data ?? []) as Row[]) {
    const key = text(event.handoff_id);
    const current = eventsByHandoff.get(key) ?? [];
    current.push(event);
    eventsByHandoff.set(key, current);
  }

  return {
    actor: crm.actor,
    can_write: crm.can_write,
    customers: crm.customers,
    products: crm.products,
    opportunities: won.map((opportunity) => {
      const handoff = handoffMap.get(text(opportunity.id)) ?? null;
      const request = (id: unknown) => requestMap.get(text(id)) ?? null;
      return {
        ...opportunity,
        handoff: handoff ? {
          ...handoff,
          contract_request: request(handoff.contract_request_id),
          subscription_request: request(handoff.subscription_request_id),
          invoice_request: request(handoff.invoice_request_id),
          events: eventsByHandoff.get(text(handoff.id)) ?? [],
        } : null,
        stages: {
          contract: stageState(requestMap, handoff, "CONTRACT"),
          subscription: stageState(requestMap, handoff, "SUBSCRIPTION"),
          invoice: stageState(requestMap, handoff, "INVOICE"),
        },
      };
    }),
    disclaimer: "Commercial handoff coordinates controlled reviews. It never signs a contract, activates a provider subscription, issues an invoice or records payment by itself.",
  };
}

export async function initializeOfficeCommercialHandoff(opportunityId: string) {
  const crm = await visibleCrm();
  if (!crm.can_write) throw new OfficeCommercialError(403, "CRM write authority is required");
  const opportunity = (crm.opportunities as Row[]).find((row) => text(row.id) === opportunityId);
  if (!opportunity || opportunity.stage !== "WON") throw new OfficeCommercialError(404, "Visible won opportunity not found");
  if (!text(opportunity.customer_id) || !text(opportunity.product_id)) throw new OfficeCommercialError(400, "Won opportunity requires a canonical customer and product before handoff");

  const { admin, identity } = await actor();
  const { data, error } = await admin.rpc("office_commercial_initialize_handoff", { p_actor: identity.userId, p_opportunity: opportunityId });
  if (error || typeof data !== "string") throw new OfficeCommercialError(400, error?.message ?? "Unable to initialize commercial handoff");
  return { handoff_id: data };
}

export async function createOfficeCommercialStageRequest(handoffId: string, stage: CommercialStage) {
  const crm = await visibleCrm();
  if (!crm.can_write) throw new OfficeCommercialError(403, "CRM write authority is required");
  const visibleOpportunityIds = new Set((crm.opportunities as Row[]).filter((row) => row.stage === "WON").map((row) => text(row.id)));
  const { admin, identity } = await actor();
  const { data: handoff, error: handoffError } = await admin.from("office_commercial_handoffs").select("id,opportunity_id").eq("id", handoffId).maybeSingle();
  if (handoffError || !handoff || !visibleOpportunityIds.has(text(handoff.opportunity_id))) throw new OfficeCommercialError(404, "Visible commercial handoff not found");

  const { data, error } = await admin.rpc("office_commercial_create_stage_request", { p_actor: identity.userId, p_handoff: handoffId, p_kind: stage });
  if (error || typeof data !== "string") throw new OfficeCommercialError(400, error?.message ?? "Unable to create commercial approval request");
  return { request_id: data, stage };
}
