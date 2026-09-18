import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  requireOfficePermission,
  resolveOfficePermission,
} from "@/lib/office/permission-engine";

export class OfficeItError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeItError";
  }
}

type Actor = Awaited<ReturnType<typeof requireOfficeActor>>;

async function actor(): Promise<Actor> {
  try { return await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeItError(error.status, error.message);
    throw error;
  }
}

async function can(current: Actor, permission: string) {
  return (await resolveOfficePermission(current.admin, current.identity, permission, { type: "COMPANY" })).allowed;
}

export async function getOfficeItOverview() {
  const current = await actor();
  const [manage, readCompany, licenseRead, licenseManage] = await Promise.all([
    can(current, "it.service.manage"),
    can(current, "it.service.read"),
    can(current, "it.license.read"),
    can(current, "it.license.manage"),
  ]);
  let tickets = current.admin.from("office_it_service_tickets")
    .select("id,ticket_code,requester_user_id,owner_user_id,department_code,category,priority,title,description,status,related_device_id,related_request_id,resolution,due_at,resolved_at,closed_at,created_at,updated_at")
    .order("created_at", { ascending: false }).limit(500);
  if (!manage && !readCompany) tickets = tickets.eq("requester_user_id", current.identity.userId);

  let devices = current.admin.from("office_device_registry")
    .select("id,user_id,device_label,device_kind,platform,trust_state,company_managed,last_seen_at")
    .order("device_label");
  if (!manage && !readCompany) devices = devices.eq("user_id", current.identity.userId);

  const [ticketResult, deviceResult, identities, licenses, assignments] = await Promise.all([
    tickets,
    devices,
    manage || licenseManage ? current.admin.from("office_identity_users").select("user_id,status,display_name,job_title,primary_department").eq("status", "ACTIVE").order("display_name") : Promise.resolve({ data: [], error: null }),
    licenseRead || licenseManage ? current.admin.from("office_software_licenses").select("id,license_code,vendor_name,product_name,plan_name,billing_cycle,total_seats,currency,cost_minor,renewal_at,notice_at,auto_renew,contract_reference,procurement_reference,status,owner_user_id,created_at,updated_at").order("renewal_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    licenseRead || licenseManage ? current.admin.from("office_software_license_assignments").select("id,license_id,user_id,assigned_by,assigned_at,expires_at,status,external_seat_reference,revoked_by,revoked_at,revocation_reason,updated_at").order("assigned_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [ticketResult, deviceResult, identities, licenses, assignments]) {
    if (result.error) throw new OfficeItError(503, "IT service records are temporarily unavailable");
  }

  const ticketIds = (ticketResult.data ?? []).map((row) => String(row.id));
  const events = ticketIds.length && (manage || readCompany)
    ? await current.admin.from("office_it_events").select("id,ticket_id,license_id,assignment_id,actor_user_id,event_type,previous_status,new_status,note,metadata,created_at").in("ticket_id", ticketIds).order("created_at", { ascending: false }).limit(800)
    : { data: [], error: null };
  if (events.error) throw new OfficeItError(503, "IT service history is temporarily unavailable");

  return {
    actor: { user_id: current.identity.userId, roles: current.identity.roles, department: current.identity.department ?? null },
    capabilities: { manage, read_company: readCompany, license_read: licenseRead, license_manage: licenseManage },
    tickets: ticketResult.data ?? [],
    devices: deviceResult.data ?? [],
    identities: identities.data ?? [],
    licenses: licenses.data ?? [],
    assignments: assignments.data ?? [],
    events: events.data ?? [],
    disclaimer: "IT tickets, software licences and company access are separate controls. Resolving a ticket does not silently grant application access, purchase software or change production credentials.",
  };
}

export async function createItTicket(input: { category: string; priority: string; title: string; description: string; deviceId?: string; dueAt?: string }) {
  const current = await actor();
  const own = await resolveOfficePermission(current.admin, current.identity, "it.service.request", { type: "OWN", ownerUserId: current.identity.userId });
  const company = own.allowed ? own : await resolveOfficePermission(current.admin, current.identity, "it.service.request", { type: "COMPANY" });
  if (!company.allowed) throw new OfficeItError(403, company.reason);
  const { data, error } = await current.admin.rpc("office_it_create_ticket", {
    p_actor: current.identity.userId,
    p_category: input.category,
    p_priority: input.priority,
    p_title: input.title,
    p_description: input.description,
    p_device: input.deviceId ?? null,
    p_due: input.dueAt ?? null,
  });
  if (error || typeof data !== "string") throw new OfficeItError(400, error?.message ?? "Unable to create IT ticket");
  return { ticket_id: data };
}

export async function transitionItTicket(input: { ticketId: string; status: string; ownerUserId?: string; note?: string }) {
  const current = await requireOfficePermission("it.service.manage", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_it_transition_ticket", {
    p_actor: current.identity.userId,
    p_ticket: input.ticketId,
    p_status: input.status,
    p_owner: input.ownerUserId ?? null,
    p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeItError(400, error?.message ?? "Unable to update IT ticket");
  return { status: data };
}

export async function createSoftwareLicense(input: { ownerUserId: string; vendor: string; product: string; plan?: string; cycle?: string; seats?: number; currency?: string; costMinor?: number; renewalAt?: string; noticeAt?: string; autoRenew?: boolean; contractReference?: string; procurementReference?: string }) {
  const current = await requireOfficePermission("it.license.manage", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_it_create_license", {
    p_actor: current.identity.userId,
    p_owner: input.ownerUserId,
    p_vendor: input.vendor,
    p_product: input.product,
    p_plan: input.plan?.trim() || null,
    p_cycle: input.cycle?.trim() || null,
    p_seats: input.seats ?? null,
    p_currency: input.currency?.trim() || null,
    p_cost: input.costMinor ?? null,
    p_renewal: input.renewalAt ?? null,
    p_notice: input.noticeAt ?? null,
    p_auto: input.autoRenew ?? false,
    p_contract: input.contractReference?.trim() || null,
    p_procurement: input.procurementReference?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeItError(400, error?.message ?? "Unable to create software licence");
  return { license_id: data };
}

export async function assignSoftwareLicense(input: { licenseId: string; userId: string; externalReference?: string; expiresAt?: string }) {
  const current = await requireOfficePermission("it.license.manage", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_it_assign_license", {
    p_actor: current.identity.userId,
    p_license: input.licenseId,
    p_user: input.userId,
    p_external_ref: input.externalReference?.trim() || null,
    p_expires: input.expiresAt ?? null,
  });
  if (error || typeof data !== "string") throw new OfficeItError(400, error?.message ?? "Unable to assign software licence");
  return { assignment_id: data };
}

export async function revokeSoftwareLicense(input: { assignmentId: string; reason: string }) {
  const current = await requireOfficePermission("it.license.manage", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_it_revoke_license", {
    p_actor: current.identity.userId,
    p_assignment: input.assignmentId,
    p_reason: input.reason,
  });
  if (error || data !== true) throw new OfficeItError(400, error?.message ?? "Unable to revoke software licence");
  return { revoked: true };
}
