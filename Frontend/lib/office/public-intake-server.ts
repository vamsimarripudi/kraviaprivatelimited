import "server-only";

import { requestPublicFormFollowUp, type PublicFormKind } from "@/lib/corporate/public-form-email";
import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";

export const publicIntakeQueues = ["GENERAL", "TRUST_DPDPA", "SECURITY_REPORTING"] as const;
export type PublicIntakeQueue = (typeof publicIntakeQueues)[number];
export const publicIntakeRecordKinds = ["CONTACT", "SUPPORT"] as const;
export type PublicIntakeRecordKind = (typeof publicIntakeRecordKinds)[number];

const supportStatuses = ["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"] as const;
const contactStatuses = ["RECEIVED", "ACKNOWLEDGED", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED"] as const;
export const publicIntakeStatuses = [...new Set([...supportStatuses, ...contactStatuses])] as string[];

type EmailDeliveryStatus = "NOT_REQUESTED" | "PENDING" | "SENT" | "FAILED" | "UNKNOWN";
type Update = {
  id: string;
  body: string;
  customer_visible: boolean;
  email_delivery_status: EmailDeliveryStatus;
  created_at: string;
};
type PublicIntakeItem = {
  id: string;
  record_kind: PublicIntakeRecordKind;
  queue: PublicIntakeQueue;
  reference: string;
  requester_name: string;
  requester_email: string;
  organisation: string | null;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  office_assigned_to: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  updates: Update[];
};
type Authority = Awaited<ReturnType<typeof requireOfficeActor>> & { decision: OfficePermissionDecision };
type ContactRow = {
  id: string; reference: string; category: string; name: string; email: string; organisation: string | null; message: string;
  status: string; office_assigned_to: string | null; version: number; created_at: string; updated_at: string;
};
type SupportRow = {
  id: string; reference: string; category: string; requester_name: string; requester_email: string; organisation: string | null;
  subject: string; description: string; status: string; priority: string; office_assigned_to: string | null; version: number; created_at: string; updated_at: string;
};

export class OfficePublicIntakeError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

function policy(queue: PublicIntakeQueue, manage: boolean) {
  if (queue === "GENERAL") return manage ? "support.case.manage" : "support.case.read";
  if (queue === "TRUST_DPDPA") return manage ? "privacy.case.manage" : "privacy.case.read";
  return manage ? "security.public_intake.manage" : "security.public_intake.read";
}

async function authority(queue: PublicIntakeQueue, manage: boolean): Promise<Authority> {
  let current: Awaited<ReturnType<typeof requireOfficeActor>>;
  try { current = await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficePublicIntakeError(error.status, error.message);
    throw error;
  }

  const permission = policy(queue, manage);
  const candidates: OfficeResourceScope[] = queue === "GENERAL"
    ? [
      ...(current.identity.department ? [{ type: "DEPARTMENT" as const, key: current.identity.department }] : []),
      { type: "COMPANY" },
    ]
    : [{ type: "COMPANY" }];
  let decision: OfficePermissionDecision | undefined;
  for (const resource of candidates) {
    const candidate = await resolveOfficePermission(current.admin, current.identity, permission, resource);
    if (candidate.allowed) { decision = candidate; break; }
    decision = candidate;
  }
  if (!decision?.allowed) throw new OfficePublicIntakeError(403, decision?.reason ?? "Public intake permission is required");
  // New, unassigned general requests belong to the Support department. A
  // department-scoped grant elsewhere cannot turn into company-wide inbox access.
  if (queue === "GENERAL" && decision.source !== "OWNER" && decision.scopeType === "DEPARTMENT" && current.identity.department !== "SUPPORT") {
    throw new OfficePublicIntakeError(403, "Public general requests are restricted to the Support department or company authority");
  }
  return { ...current, decision };
}

function deliveryStatus(value: unknown): EmailDeliveryStatus {
  return value === "PENDING" || value === "SENT" || value === "FAILED" || value === "UNKNOWN" ? value : "NOT_REQUESTED";
}

function isSupportStatus(value: string): value is (typeof supportStatuses)[number] { return (supportStatuses as readonly string[]).includes(value); }
function isContactStatus(value: string): value is (typeof contactStatuses)[number] { return (contactStatuses as readonly string[]).includes(value); }
function updatesById(rows: Array<Record<string, unknown>>) {
  const result = new Map<string, Update[]>();
  for (const row of rows) {
    const sourceId = typeof row.case_id === "string" ? row.case_id : typeof row.enquiry_id === "string" ? row.enquiry_id : null;
    if (!sourceId || typeof row.id !== "string" || typeof row.body !== "string" || typeof row.created_at !== "string") continue;
    const list = result.get(sourceId) ?? [];
    list.push({ id: row.id, body: row.body, customer_visible: row.customer_visible === true, email_delivery_status: deliveryStatus(row.email_delivery_status), created_at: row.created_at });
    result.set(sourceId, list);
  }
  return result;
}

function formKind(item: Pick<PublicIntakeItem, "record_kind" | "queue">): PublicFormKind {
  if (item.record_kind === "CONTACT") return "CONTACT";
  return item.queue === "GENERAL" ? "SUPPORT" : "TRUST_REQUEST";
}

function assertTransition(item: PublicIntakeItem, nextStatus: string) {
  const valid = item.record_kind === "CONTACT" ? isContactStatus(nextStatus) : isSupportStatus(nextStatus);
  if (!valid) throw new OfficePublicIntakeError(400, "Invalid public request workflow state");
  if (item.status === "CLOSED") throw new OfficePublicIntakeError(409, "Closed public requests are immutable");
  if (item.status === "RESOLVED" && nextStatus !== "RESOLVED" && nextStatus !== "CLOSED") {
    throw new OfficePublicIntakeError(409, "Resolved public requests can only be closed");
  }
  if (nextStatus === "CLOSED" && item.status !== "RESOLVED") {
    throw new OfficePublicIntakeError(409, "Resolve the public request before closing it");
  }
}

async function itemFor(authorityContext: Authority, queue: PublicIntakeQueue, recordKind: PublicIntakeRecordKind, id: string): Promise<PublicIntakeItem> {
  if (recordKind === "CONTACT") {
    if (queue !== "GENERAL") throw new OfficePublicIntakeError(400, "Contact requests belong to the general support queue");
    const { data, error } = await authorityContext.admin
      .from("contact_enquiries")
      .select("id,reference,category,name,email,organisation,message,status,office_assigned_to,version,created_at,updated_at")
      .eq("id", id).maybeSingle();
    if (error || !data) throw new OfficePublicIntakeError(404, "Public contact request not found");
    const row = data as ContactRow;
    return {
      id: row.id, record_kind: "CONTACT", queue, reference: row.reference, requester_name: row.name, requester_email: row.email,
      organisation: row.organisation, category: row.category, subject: `Contact enquiry · ${row.category}`, description: row.message,
      status: row.status, priority: "NORMAL", office_assigned_to: row.office_assigned_to, version: row.version,
      created_at: row.created_at, updated_at: row.updated_at, updates: [],
    };
  }
  const { data, error } = await authorityContext.admin
    .from("support_cases")
    .select("id,reference,category,requester_name,requester_email,organisation,subject,description,status,priority,office_assigned_to,version,created_at,updated_at")
    .eq("id", id).eq("queue", queue).maybeSingle();
  if (error || !data) throw new OfficePublicIntakeError(404, "Public support request not found");
  const row = data as SupportRow;
  return { ...row, record_kind: "SUPPORT", queue, updates: [] };
}

async function insertInternalUpdate(authorityContext: Authority, item: PublicIntakeItem, body: string) {
  if (item.record_kind === "CONTACT") {
    const { data, error } = await authorityContext.admin.from("contact_enquiry_updates")
      .insert({ enquiry_id: item.id, office_author_user_id: authorityContext.identity.userId, body, customer_visible: false })
      .select("id").single();
    if (error || !data?.id) throw new OfficePublicIntakeError(503, "Unable to record the contact request event");
    return String(data.id);
  }
  const { data, error } = await authorityContext.admin.from("support_case_updates")
    .insert({ case_id: item.id, author_kind: "KRAVIA", office_author_user_id: authorityContext.identity.userId, body, customer_visible: false })
    .select("id").single();
  if (error || !data?.id) throw new OfficePublicIntakeError(503, "Unable to record the public support event");
  return String(data.id);
}

async function updateWorkflow(authorityContext: Authority, item: PublicIntakeItem, nextStatus: string, officeAssignee = item.office_assigned_to) {
  assertTransition(item, nextStatus);
  const table = item.record_kind === "CONTACT" ? "contact_enquiries" : "support_cases";
  const values = item.record_kind === "CONTACT"
    ? { status: nextStatus, office_assigned_to: officeAssignee, updated_at: new Date().toISOString(), version: item.version + 1 }
    : { status: nextStatus, office_assigned_to: officeAssignee, updated_at: new Date().toISOString(), version: item.version + 1 };
  const { data, error } = await authorityContext.admin.from(table).update(values).eq("id", item.id).eq("version", item.version).select("id").maybeSingle();
  if (error || !data?.id) throw new OfficePublicIntakeError(409, "The public request changed before this action could be saved. Refresh and retry.");
}

export async function getOfficePublicIntakeOverview(queue: PublicIntakeQueue) {
  const read = await authority(queue, false);
  const [contactsResult, supportResult] = await Promise.all([
    queue === "GENERAL"
      ? read.admin.from("contact_enquiries").select("id,reference,category,name,email,organisation,message,status,office_assigned_to,version,created_at,updated_at").order("updated_at", { ascending: false }).limit(250)
      : Promise.resolve({ data: [] as ContactRow[], error: null }),
    read.admin.from("support_cases").select("id,reference,category,requester_name,requester_email,organisation,subject,description,status,priority,office_assigned_to,version,created_at,updated_at").eq("queue", queue).order("updated_at", { ascending: false }).limit(250),
  ]);
  if (contactsResult.error || supportResult.error) throw new OfficePublicIntakeError(503, "Public intake requests are temporarily unavailable");
  const contacts = (contactsResult.data ?? []) as ContactRow[];
  const supports = (supportResult.data ?? []) as SupportRow[];
  const contactIds = contacts.map((row) => row.id);
  const supportIds = supports.map((row) => row.id);
  const [contactUpdatesResult, supportUpdatesResult] = await Promise.all([
    contactIds.length ? read.admin.from("contact_enquiry_updates").select("id,enquiry_id,body,customer_visible,email_delivery_status,created_at").in("enquiry_id", contactIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    supportIds.length ? read.admin.from("support_case_updates").select("id,case_id,body,customer_visible,email_delivery_status,created_at").in("case_id", supportIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
  ]);
  if (contactUpdatesResult.error || supportUpdatesResult.error) throw new OfficePublicIntakeError(503, "Public intake history is temporarily unavailable");
  const updates = new Map([...updatesById((contactUpdatesResult.data ?? []) as Record<string, unknown>[]), ...updatesById((supportUpdatesResult.data ?? []) as Record<string, unknown>[])]);
  const items: PublicIntakeItem[] = [
    ...contacts.map((row) => ({
      id: row.id, record_kind: "CONTACT" as const, queue, reference: row.reference, requester_name: row.name, requester_email: row.email,
      organisation: row.organisation, category: row.category, subject: `Contact enquiry · ${row.category}`, description: row.message,
      status: row.status, priority: "NORMAL", office_assigned_to: row.office_assigned_to, version: row.version,
      created_at: row.created_at, updated_at: row.updated_at, updates: updates.get(row.id) ?? [],
    })),
    ...supports.map((row) => ({ ...row, record_kind: "SUPPORT" as const, queue, updates: updates.get(row.id) ?? [] })),
  ].sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
  let canManage = false;
  try { await authority(queue, true); canManage = true; }
  catch (error) { if (!(error instanceof OfficePublicIntakeError && error.status === 403)) throw error; }
  return {
    queue,
    can_manage: canManage,
    scope: { type: read.decision.scopeType ?? null, key: read.decision.scopeKey ?? null },
    items,
    disclaimer: "Public requests remain in their original intake records. Every Office claim, workflow change and response is recorded before any email is requested.",
  };
}

export async function claimOfficePublicIntake(input: { queue: PublicIntakeQueue; recordKind: PublicIntakeRecordKind; id: string; version: number }) {
  const write = await authority(input.queue, true);
  const item = await itemFor(write, input.queue, input.recordKind, input.id);
  if (item.version !== input.version) throw new OfficePublicIntakeError(409, "The public request changed before it could be claimed. Refresh and retry.");
  if (item.office_assigned_to && item.office_assigned_to !== write.identity.userId) throw new OfficePublicIntakeError(409, "This public request is already claimed by another Office reviewer");
  if (item.office_assigned_to === write.identity.userId) return { claimed: true, already_claimed: true };
  const nextStatus = item.record_kind === "CONTACT" && item.status === "RECEIVED" ? "ACKNOWLEDGED" : item.record_kind === "SUPPORT" && item.status === "NEW" ? "ACKNOWLEDGED" : item.status;
  await updateWorkflow(write, item, nextStatus, write.identity.userId);
  await insertInternalUpdate(write, item, "Request claimed for Office review.");
  return { claimed: true, already_claimed: false };
}

export async function transitionOfficePublicIntake(input: { queue: PublicIntakeQueue; recordKind: PublicIntakeRecordKind; id: string; version: number; status: string }) {
  const write = await authority(input.queue, true);
  const item = await itemFor(write, input.queue, input.recordKind, input.id);
  if (item.version !== input.version) throw new OfficePublicIntakeError(409, "The public request changed before its workflow could be updated. Refresh and retry.");
  await updateWorkflow(write, item, input.status);
  await insertInternalUpdate(write, item, `Workflow status changed to ${input.status.replaceAll("_", " ")}.`);
  return { status: input.status };
}

export async function addOfficePublicIntakeFollowUp(input: { queue: PublicIntakeQueue; recordKind: PublicIntakeRecordKind; id: string; version: number; body: string }) {
  const write = await authority(input.queue, true);
  const item = await itemFor(write, input.queue, input.recordKind, input.id);
  if (item.version !== input.version) throw new OfficePublicIntakeError(409, "The public request changed before the follow-up could be saved. Refresh and retry.");
  if (item.status === "CLOSED") throw new OfficePublicIntakeError(409, "Closed public requests cannot receive a new follow-up");
  const body = input.body.trim();
  if (!body || body.length > 5000) throw new OfficePublicIntakeError(400, "A follow-up must contain between 1 and 5,000 characters");
  const defaultStatus = item.record_kind === "CONTACT" ? "WAITING_FOR_REQUESTER" : "WAITING_FOR_CUSTOMER";
  await updateWorkflow(write, item, defaultStatus);

  const eventId = `public-followup:${item.reference}:${crypto.randomUUID()}`;
  let updateId: string;
  if (item.record_kind === "CONTACT") {
    const { data, error } = await write.admin.from("contact_enquiry_updates")
      .insert({ enquiry_id: item.id, office_author_user_id: write.identity.userId, body, customer_visible: true, email_delivery_event_id: eventId, email_delivery_status: "PENDING" })
      .select("id").single();
    if (error || !data?.id) throw new OfficePublicIntakeError(503, "The follow-up could not be recorded");
    updateId = String(data.id);
  } else {
    const { data, error } = await write.admin.from("support_case_updates")
      .insert({ case_id: item.id, author_kind: "KRAVIA", office_author_user_id: write.identity.userId, body, customer_visible: true, email_delivery_event_id: eventId, email_delivery_status: "PENDING" })
      .select("id").single();
    if (error || !data?.id) throw new OfficePublicIntakeError(503, "The follow-up could not be recorded");
    updateId = String(data.id);
  }
  const result = await requestPublicFormFollowUp({
    eventId,
    formKind: formKind(item),
    reference: item.reference,
    recipientEmail: item.requester_email,
    recipientName: item.requester_name,
    message: body,
  });
  const recorded = result === "sent" ? "SENT" : result === "unknown" ? "UNKNOWN" : "FAILED";
  const deliveryResult = item.record_kind === "CONTACT"
    ? await write.admin.from("contact_enquiry_updates").update({ email_delivery_status: recorded, email_delivery_recorded_at: new Date().toISOString() }).eq("id", updateId)
    : await write.admin.from("support_case_updates").update({ email_delivery_status: recorded, email_delivery_recorded_at: new Date().toISOString() }).eq("id", updateId);
  const deliveryError = deliveryResult.error;
  return { update_id: updateId, email_delivery: result, delivery_recorded: !deliveryError };
}
