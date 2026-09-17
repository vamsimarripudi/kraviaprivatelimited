import "server-only";

import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";

export class OfficeCalendarError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeCalendarError";
  }
}

type EventInput = {
  title: string;
  description?: string;
  eventType: "MEETING" | "DEADLINE" | "LAUNCH" | "CUSTOMER" | "MAINTENANCE" | "REVIEW" | "REMINDER" | "OTHER";
  visibility: "PERSONAL" | "COMPANY" | "DEPARTMENT" | "TEAM";
  scopeKey?: string;
  startsAt: string;
  endsAt?: string;
  allDay?: boolean;
};

type InternalCalendarRow = {
  id: string;
  event_code: string;
  title: string;
  description: string;
  event_type: string;
  visibility_scope: string;
  scope_key: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  created_by: string;
  owner_user_id: string;
  source_type: string | null;
  source_key: string | null;
  status: string;
};

async function actor() {
  try {
    return await requireOfficeActor();
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeCalendarError(error.status, error.message);
    throw error;
  }
}

function dateIso(value: unknown, endOfDay = false) {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const parsed = new Date(dayOnly ? `${raw}T${endOfDay ? "23:59:59" : "00:00:00"}+05:30` : raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function projected(source: string, sourceKey: string, title: string, startsAt: string | null, eventType: string, description: string) {
  if (!startsAt) return null;
  return {
    id: `projected:${source}:${sourceKey}`,
    event_code: null,
    title,
    description,
    event_type: eventType,
    visibility_scope: "SYSTEM",
    scope_key: null,
    starts_at: startsAt,
    ends_at: null,
    all_day: true,
    created_by: null,
    owner_user_id: null,
    source_type: source,
    source_key: sourceKey,
    status: "ACTIVE",
    projected: true,
  };
}

export async function getOfficeCompanyCalendar() {
  const { admin, identity } = await actor();
  const privileged = identity.roles.some((role) => ["OWNER", "DIRECTOR", "ADMIN"].includes(role));
  const governance = identity.roles.some((role) => ["OWNER", "DIRECTOR", "CS", "LEGAL"].includes(role));
  const compliance = identity.roles.some((role) => ["OWNER", "DIRECTOR", "CS", "LEGAL", "CA", "AUDITOR"].includes(role));
  const legalOps = identity.roles.some((role) => ["OWNER", "DIRECTOR", "LEGAL", "OPERATIONS"].includes(role));
  const commercial = identity.roles.some((role) => ["OWNER", "DIRECTOR", "OPERATIONS", "PRODUCT_ADMIN", "FINANCE", "CA"].includes(role));

  const [identityResult, jobResult, eventsResult, tasksResult] = await Promise.all([
    admin.from("office_identity_users").select("primary_department").eq("user_id", identity.userId).maybeSingle(),
    admin.from("office_job_assignments").select("team_key").eq("user_id", identity.userId).eq("status", "ACTIVE").maybeSingle(),
    admin.from("office_calendar_events").select("id,event_code,title,description,event_type,visibility_scope,scope_key,starts_at,ends_at,all_day,created_by,owner_user_id,source_type,source_key,status").eq("status", "ACTIVE").order("starts_at", { ascending: true }).limit(500),
    admin.from("office_tasks").select("id,task_code,title,description,due_at,assigned_user_id,created_by,status").not("due_at", "is", null).not("status", "in", '("DONE","CANCELLED")').order("due_at", { ascending: true }).limit(250),
  ]);
  if (identityResult.error || jobResult.error || eventsResult.error || tasksResult.error) throw new OfficeCalendarError(503, "Calendar authority is temporarily unavailable");

  const department = identityResult.data?.primary_department ?? null;
  const team = jobResult.data?.team_key ?? null;
  const internal = ((eventsResult.data ?? []) as InternalCalendarRow[]).filter((event) => {
    if (privileged || event.created_by === identity.userId || event.owner_user_id === identity.userId) return true;
    if (event.visibility_scope === "COMPANY") return true;
    if (event.visibility_scope === "PERSONAL") return event.owner_user_id === identity.userId;
    if (event.visibility_scope === "DEPARTMENT") return Boolean(department && event.scope_key === department);
    if (event.visibility_scope === "TEAM") return Boolean(team && event.scope_key === team);
    return false;
  });

  const taskEvents = (tasksResult.data ?? []).filter((task) => privileged || task.assigned_user_id === identity.userId || task.created_by === identity.userId).map((task) => projected(
    "TASK",
    String(task.id),
    `Task due · ${task.title}`,
    dateIso(task.due_at),
    "DEADLINE",
    task.description || task.task_code || "Company Inbox task due date",
  )).filter(Boolean);

  const synthetic: Array<Record<string, unknown>> = [...taskEvents] as Array<Record<string, unknown>>;

  if (compliance) {
    const { data, error } = await admin.from("compliance_obligations").select("id,title,authority,due_date,status,risk").not("due_date", "is", null).order("due_date", { ascending: true }).limit(250);
    if (error) throw new OfficeCalendarError(503, "Compliance calendar is temporarily unavailable");
    for (const row of data ?? []) {
      const event = projected("COMPLIANCE", String(row.id), `Compliance · ${row.title}`, dateIso(row.due_date), "DEADLINE", `${row.authority} · ${row.status}${row.risk ? ` · ${row.risk}` : ""}`);
      if (event) synthetic.push(event);
    }
  }

  if (governance) {
    const { data, error } = await admin.from("board_meetings").select("id,meeting_no,meeting_date,title,status").not("meeting_date", "is", null).order("meeting_date", { ascending: true }).limit(100);
    if (error) throw new OfficeCalendarError(503, "Governance calendar is temporarily unavailable");
    for (const row of data ?? []) {
      const event = projected("BOARD_MEETING", String(row.id), `Board · ${row.title}`, dateIso(row.meeting_date), "MEETING", `${row.meeting_no} · ${row.status}`);
      if (event) synthetic.push(event);
    }
  }

  if (legalOps) {
    const { data, error } = await admin.from("contracts").select("id,contract_no,counterparty_name,expiry_date,status").not("expiry_date", "is", null).order("expiry_date", { ascending: true }).limit(150);
    if (error) throw new OfficeCalendarError(503, "Contract calendar is temporarily unavailable");
    for (const row of data ?? []) {
      const event = projected("CONTRACT", String(row.id), `Contract expiry · ${row.counterparty_name}`, dateIso(row.expiry_date, true), "DEADLINE", `${row.contract_no} · ${row.status}`);
      if (event) synthetic.push(event);
    }
  }

  if (commercial) {
    const { data, error } = await admin.from("subscriptions").select("id,customer_id,product_id,current_period_end,status,cancel_at_period_end").not("current_period_end", "is", null).order("current_period_end", { ascending: true }).limit(200);
    if (error) throw new OfficeCalendarError(503, "Subscription calendar is temporarily unavailable");
    for (const row of data ?? []) {
      const event = projected("SUBSCRIPTION", String(row.id), "Subscription period end", dateIso(row.current_period_end, true), "CUSTOMER", `${row.status}${row.cancel_at_period_end ? " · cancels at period end" : ""}`);
      if (event) synthetic.push(event);
    }
  }

  const events = [...internal.map((event) => ({ ...event, projected: false })), ...synthetic]
    .sort((left, right) => String(left.starts_at).localeCompare(String(right.starts_at)));

  return {
    actor: { user_id: identity.userId, roles: identity.roles, department, team, privileged },
    generated_at: new Date().toISOString(),
    events,
  };
}

export async function createOfficeCalendarEvent(input: EventInput) {
  const { admin, identity } = await actor();
  const { data, error } = await admin.rpc("office_create_calendar_event", {
    p_actor: identity.userId,
    p_title: input.title,
    p_description: input.description ?? "",
    p_event_type: input.eventType,
    p_visibility: input.visibility,
    p_scope_key: input.scopeKey?.trim() || null,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt ?? null,
    p_all_day: input.allDay ?? false,
  });
  if (error || typeof data !== "string") throw new OfficeCalendarError(400, error?.message ?? "Unable to create calendar event");
  return { event_id: data };
}

export async function cancelOfficeCalendarEvent(eventId: string) {
  const { admin, identity } = await actor();
  const { data, error } = await admin.rpc("office_cancel_calendar_event", { p_actor: identity.userId, p_event: eventId });
  if (error || data !== true) throw new OfficeCalendarError(400, error?.message ?? "Unable to cancel calendar event");
  return { cancelled: true };
}
