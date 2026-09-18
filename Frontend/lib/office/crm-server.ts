import "server-only";

import { readOfficeRuntimeResult } from "@/lib/office/runtime-read-server";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";

export class OfficeCrmError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeCrmError";
  }
}

type CrmAuthority = Awaited<ReturnType<typeof requireOfficeActor>> & { decision: OfficePermissionDecision; ownerIds: string[] | null };
type LeadInput = { ownerUserId: string; accountName: string; contactName?: string; contactEmail?: string; contactPhone?: string; source?: string; valueMinor?: number; currency?: string; country?: string; notes?: string };
type OpportunityInput = { ownerUserId: string; leadId?: string; customerId?: string; productId?: string; title: string; valueMinor?: number; currency?: string; expectedCloseDate?: string; nextStep?: string };

async function permission(permissionCode: "sales.crm.read" | "sales.crm.write"): Promise<CrmAuthority> {
  let actor: Awaited<ReturnType<typeof requireOfficeActor>>;
  try {
    actor = await requireOfficeActor();
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeCrmError(error.status, error.message);
    throw error;
  }

  const candidates: OfficeResourceScope[] = [
    ...(actor.identity.department ? [{ type: "DEPARTMENT" as const, key: actor.identity.department }] : []),
    { type: "OWN", ownerUserId: actor.identity.userId },
    { type: "COMPANY" },
  ];
  let decision: OfficePermissionDecision | undefined;
  for (const resource of candidates) {
    const current = await resolveOfficePermission(actor.admin, actor.identity, permissionCode, resource);
    if (current.allowed) { decision = current; break; }
    decision = current;
  }
  if (!decision?.allowed) throw new OfficeCrmError(403, decision?.reason ?? "CRM permission is required");

  let ownerIds: string[] | null = null;
  if (decision.source !== "OWNER" && decision.scopeType === "OWN") {
    ownerIds = [actor.identity.userId];
  } else if (decision.source !== "OWNER" && decision.scopeType === "DEPARTMENT") {
    const department = decision.scopeKey || actor.identity.department;
    if (!department) ownerIds = [actor.identity.userId];
    else {
      const { data, error } = await actor.admin.from("office_identity_users").select("user_id").eq("status", "ACTIVE").eq("primary_department", department);
      if (error) throw new OfficeCrmError(503, "Unable to resolve CRM department scope");
      ownerIds = (data ?? []).map((row) => row.user_id as string);
    }
  }
  return { ...actor, decision, ownerIds };
}

function applyOwnerScope<T>(query: T, ownerIds: string[] | null) {
  if (!ownerIds) return query;
  return (query as T & { in: (column: string, values: string[]) => T }).in("owner_user_id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);
}

function ownerAllowed(ownerIds: string[] | null, ownerUserId: string) {
  return !ownerIds || ownerIds.includes(ownerUserId);
}

async function ensureWritableEntity(admin: CrmAuthority["admin"], table: "office_crm_leads" | "office_crm_opportunities", id: string, ownerIds: string[] | null) {
  const { data, error } = await admin.from(table).select("id,owner_user_id").eq("id", id).maybeSingle();
  if (error || !data) throw new OfficeCrmError(404, table === "office_crm_leads" ? "Lead not found" : "Opportunity not found");
  if (!ownerAllowed(ownerIds, String(data.owner_user_id))) throw new OfficeCrmError(403, "Record is outside your CRM scope");
  return data;
}

export async function getOfficeCrmOverview() {
  const read = await permission("sales.crm.read");
  let leadsQuery = read.admin.from("office_crm_leads").select("id,lead_code,account_name,contact_name,contact_email,contact_phone,source,stage,owner_user_id,estimated_value_minor,currency,country,notes,converted_customer_id,created_at,updated_at").order("created_at", { ascending: false }).limit(250);
  let opportunitiesQuery = read.admin.from("office_crm_opportunities").select("id,opportunity_code,lead_id,customer_id,product_id,title,stage,owner_user_id,value_minor,currency,expected_close_date,next_step,lost_reason,won_at,lost_at,created_at,updated_at").order("updated_at", { ascending: false }).limit(300);
  leadsQuery = applyOwnerScope(leadsQuery, read.ownerIds);
  opportunitiesQuery = applyOwnerScope(opportunitiesQuery, read.ownerIds);

  const [leadsResult, opportunitiesResult, customersResult, productsResult] = await Promise.all([
    leadsQuery,
    opportunitiesQuery,
    readOfficeRuntimeResult<Array<Record<string,unknown>>>("customers").then((result)=>({
      ...result,
      data:(result.data??[]).slice(0,500).sort((a,b)=>String(a.legal_name||"").localeCompare(String(b.legal_name||""))),
    })),
    readOfficeRuntimeResult<Array<Record<string,unknown>>>("products").then((result)=>({
      ...result,
      data:(result.data??[]).slice(0,200).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""))),
    })),
  ]);
  if (leadsResult.error || opportunitiesResult.error || customersResult.error || productsResult.error) throw new OfficeCrmError(503, "CRM authority is temporarily unavailable");

  const leadIds = (leadsResult.data ?? []).map((row) => row.id as string);
  const opportunityIds = (opportunitiesResult.data ?? []).map((row) => row.id as string);
  let activities: Array<Record<string, unknown>> = [];
  if (leadIds.length || opportunityIds.length) {
    const filters = [leadIds.length ? `lead_id.in.(${leadIds.join(",")})` : "", opportunityIds.length ? `opportunity_id.in.(${opportunityIds.join(",")})` : ""].filter(Boolean).join(",");
    const { data, error } = await read.admin.from("office_crm_activities").select("id,lead_id,opportunity_id,activity_type,subject,body,occurred_at,actor_user_id,created_at").or(filters).order("occurred_at", { ascending: false }).limit(300);
    if (error) throw new OfficeCrmError(503, "CRM activity history is temporarily unavailable");
    activities = (data ?? []) as Array<Record<string, unknown>>;
  }

  let ownersQuery = read.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status", "ACTIVE").order("display_name", { ascending: true });
  if (read.ownerIds) ownersQuery = ownersQuery.in("user_id", read.ownerIds.length ? read.ownerIds : [read.identity.userId]);
  const ownersResult = await ownersQuery;
  if (ownersResult.error) throw new OfficeCrmError(503, "Unable to resolve CRM owners");

  let canWrite = false;
  try { await permission("sales.crm.write"); canWrite = true; } catch (error) { if (!(error instanceof OfficeCrmError && error.status === 403)) throw error; }

  return {
    actor: { user_id: read.identity.userId, roles: read.identity.roles, department: read.identity.department ?? null },
    scope: { source: read.decision.source ?? null, type: read.decision.scopeType ?? null, key: read.decision.scopeKey ?? null },
    can_write: canWrite,
    owners: ownersResult.data ?? [],
    customers: customersResult.data ?? [],
    products: productsResult.data ?? [],
    leads: leadsResult.data ?? [],
    opportunities: opportunitiesResult.data ?? [],
    activities,
  };
}

export async function createOfficeCrmLead(input: LeadInput) {
  const write = await permission("sales.crm.write");
  if (!ownerAllowed(write.ownerIds, input.ownerUserId)) throw new OfficeCrmError(403, "Lead owner is outside your CRM scope");
  const { data, error } = await write.admin.rpc("office_crm_create_lead", {
    p_actor: write.identity.userId,
    p_owner: input.ownerUserId,
    p_account: input.accountName,
    p_contact: input.contactName?.trim() || null,
    p_email: input.contactEmail?.trim() || null,
    p_phone: input.contactPhone?.trim() || null,
    p_source: input.source?.trim() || "OTHER",
    p_value: input.valueMinor ?? null,
    p_currency: (input.currency || "INR").toUpperCase(),
    p_country: input.country?.trim() || null,
    p_notes: input.notes?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeCrmError(400, error?.message ?? "Unable to create CRM lead");
  return { lead_id: data };
}

export async function setOfficeCrmLeadStage(input: { leadId: string; stage: "NEW" | "QUALIFIED" | "DISQUALIFIED" | "CONVERTED"; customerId?: string }) {
  const write = await permission("sales.crm.write");
  await ensureWritableEntity(write.admin, "office_crm_leads", input.leadId, write.ownerIds);
  if (input.stage === "CONVERTED") {
    if (!input.customerId) throw new OfficeCrmError(400, "A canonical customer is required before conversion");
    const customers = await readOfficeRuntimeResult<Array<{id:string}>>("customers");
    if (customers.error || !(customers.data??[]).some((customer)=>customer.id===input.customerId)) throw new OfficeCrmError(400, "Canonical customer not found");
  }
  const { data, error } = await write.admin.rpc("office_crm_set_lead_stage", { p_actor: write.identity.userId, p_lead: input.leadId, p_stage: input.stage, p_customer: input.customerId ?? null });
  if (error || typeof data !== "string") throw new OfficeCrmError(400, error?.message ?? "Unable to update lead stage");
  return { stage: data };
}

export async function createOfficeCrmOpportunity(input: OpportunityInput) {
  const write = await permission("sales.crm.write");
  if (!ownerAllowed(write.ownerIds, input.ownerUserId)) throw new OfficeCrmError(403, "Opportunity owner is outside your CRM scope");
  if (input.leadId) await ensureWritableEntity(write.admin, "office_crm_leads", input.leadId, write.ownerIds);
  const { data, error } = await write.admin.rpc("office_crm_create_opportunity", {
    p_actor: write.identity.userId,
    p_owner: input.ownerUserId,
    p_lead: input.leadId ?? null,
    p_customer: input.customerId ?? null,
    p_product: input.productId ?? null,
    p_title: input.title,
    p_value: input.valueMinor ?? null,
    p_currency: (input.currency || "INR").toUpperCase(),
    p_close: input.expectedCloseDate ?? null,
    p_next_step: input.nextStep?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeCrmError(400, error?.message ?? "Unable to create opportunity");
  return { opportunity_id: data };
}

export async function setOfficeCrmOpportunityStage(input: { opportunityId: string; stage: "QUALIFICATION" | "DISCOVERY" | "DEMO" | "PROPOSAL" | "NEGOTIATION" | "CONTRACTING" | "WON" | "LOST"; nextStep?: string; lostReason?: string }) {
  const write = await permission("sales.crm.write");
  await ensureWritableEntity(write.admin, "office_crm_opportunities", input.opportunityId, write.ownerIds);
  const { data, error } = await write.admin.rpc("office_crm_set_opportunity_stage", {
    p_actor: write.identity.userId,
    p_opportunity: input.opportunityId,
    p_stage: input.stage,
    p_next_step: input.nextStep?.trim() || null,
    p_lost_reason: input.lostReason?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeCrmError(400, error?.message ?? "Unable to update opportunity stage");
  return { stage: data };
}

export async function addOfficeCrmActivity(input: { leadId?: string; opportunityId?: string; activityType: "NOTE" | "CALL" | "EMAIL" | "MEETING" | "DEMO" | "PROPOSAL" | "FOLLOW_UP"; subject: string; body?: string; occurredAt?: string }) {
  const write = await permission("sales.crm.write");
  if (!input.leadId && !input.opportunityId) throw new OfficeCrmError(400, "Lead or opportunity is required");
  if (input.leadId) await ensureWritableEntity(write.admin, "office_crm_leads", input.leadId, write.ownerIds);
  if (input.opportunityId) await ensureWritableEntity(write.admin, "office_crm_opportunities", input.opportunityId, write.ownerIds);
  const { data, error } = await write.admin.rpc("office_crm_add_activity", {
    p_actor: write.identity.userId,
    p_lead: input.leadId ?? null,
    p_opportunity: input.opportunityId ?? null,
    p_type: input.activityType,
    p_subject: input.subject,
    p_body: input.body?.trim() || null,
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
  });
  if (error || typeof data !== "string") throw new OfficeCrmError(400, error?.message ?? "Unable to log CRM activity");
  return { activity_id: data };
}
