import "server-only";

import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";

export class OfficeCalendarError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeCalendarError";
  }
}

type CalendarEvent = {
  id: string;
  source: string;
  title: string;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  all_day: boolean;
  visibility: string;
  href: string;
  status?: string | null;
  priority?: string | null;
};

async function actor() {
  try {
    return await requireOfficeActor();
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeCalendarError(error.status, error.message);
    throw error;
  }
}

export async function getOfficeCompanyCalendar(input: { start?: string; end?: string } = {}) {
  const { admin, identity } = await actor();
  const start = input.start ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end = input.end ?? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  const roles = new Set(identity.roles);
  const canSeeGovernance = [...roles].some((role) => ["OWNER", "DIRECTOR", "CS", "LEGAL"].includes(role));
  const canSeeCompliance = [...roles].some((role) => ["OWNER", "DIRECTOR", "CS", "LEGAL", "CA", "AUDITOR"].includes(role));
  const canSeeContracts = [...roles].some((role) => ["OWNER", "DIRECTOR", "LEGAL", "OPERATIONS"].includes(role));
  const canSeeSubscriptions = [...roles].some((role) => ["OWNER", "DIRECTOR", "OPERATIONS", "PRODUCT_ADMIN"].includes(role));

  let internalQuery = admin.from("office_calendar_events").select("id,title,description,start_at,end_at,all_day,visibility,owner_user_id,department_code,status,created_at,updated_at").lte("start_at", end).or(`end_at.is.null,end_at.gte.${start}`).order("start_at", { ascending: true }).limit(500);
  if (!roles.has("OWNER") && !roles.has("DIRECTOR")) {
    const clauses = [`visibility.eq.COMPANY`, `owner_user_id.eq.${identity.userId}`];
    if (identity.department) clauses.push(`and(visibility.eq.DEPARTMENT,department_code.eq.${identity.department})`);
    internalQuery = internalQuery.or(clauses.join(","));
  }

  let taskQuery = admin.from("office_tasks").select("id,task_code,title,description,priority,status,assigned_user_id,created_by,department_code,due_at").not("due_at", "is", null).gte("due_at", start).lte("due_at", end).order("due_at", { ascending: true }).limit(500);
  if (!roles.has("OWNER") && !roles.has("DIRECTOR") && !roles.has("ADMIN")) taskQuery = taskQuery.or(`assigned_user_id.eq.${identity.userId},created_by.eq.${identity.userId}`);

  const boardQuery = canSeeGovernance
    ? admin.from("office_board_meetings").select("id,meeting_code,meeting_kind,title,scheduled_start,scheduled_end,venue_mode,venue_details,status").gte("scheduled_start", start).lte("scheduled_start", end).order("scheduled_start", { ascending: true }).limit(200)
    : null;

  let boardActionQuery = admin.from("office_board_actions").select("id,action_code,meeting_id,title,description,owner_user_id,due_at,status").not("due_at", "is", null).gte("due_at", start).lte("due_at", end).order("due_at", { ascending: true }).limit(300);
  if (!canSeeGovernance) boardActionQuery = boardActionQuery.eq("owner_user_id", identity.userId);

  let followupQuery = admin.from("office_secretarial_followups").select("id,followup_code,meeting_id,title,authority,form_code,due_at,due_basis,owner_user_id,reviewer_user_id,status").not("due_at", "is", null).gte("due_at", start).lte("due_at", end).order("due_at", { ascending: true }).limit(300);
  if (!canSeeGovernance) followupQuery = followupQuery.or(`owner_user_id.eq.${identity.userId},reviewer_user_id.eq.${identity.userId}`);

  const complianceQuery = canSeeCompliance
    ? admin.from("compliance_obligations").select("id,title,authority,due_date,status,risk").not("due_date", "is", null).gte("due_date", start).lte("due_date", end).order("due_date", { ascending: true }).limit(300)
    : null;
  const contractsQuery = canSeeContracts
    ? admin.from("contracts").select("id,contract_no,counterparty_name,expiry_date,status,notice_days").not("expiry_date", "is", null).gte("expiry_date", start).lte("expiry_date", end).order("expiry_date", { ascending: true }).limit(300)
    : null;
  const subscriptionsQuery = canSeeSubscriptions
    ? admin.from("subscriptions").select("id,customer_id,product_id,status,current_period_end,cancel_at_period_end").not("current_period_end", "is", null).gte("current_period_end", start).lte("current_period_end", end).order("current_period_end", { ascending: true }).limit(300)
    : null;

  const [internal, tasks, board, boardActions, followups, compliance, contracts, subscriptions] = await Promise.all([
    internalQuery,
    taskQuery,
    boardQuery ?? Promise.resolve({ data: [], error: null }),
    boardActionQuery,
    followupQuery,
    complianceQuery ?? Promise.resolve({ data: [], error: null }),
    contractsQuery ?? Promise.resolve({ data: [], error: null }),
    subscriptionsQuery ?? Promise.resolve({ data: [], error: null }),
  ]);
  if (internal.error || tasks.error || board.error || boardActions.error || followups.error || compliance.error || contracts.error || subscriptions.error) throw new OfficeCalendarError(503, "Company calendar sources are temporarily unavailable");

  const events: CalendarEvent[] = [];
  for (const row of internal.data ?? []) events.push({ id: `internal:${row.id}`, source: "INTERNAL", title: row.title, description: row.description, start_at: row.start_at, end_at: row.end_at, all_day: Boolean(row.all_day), visibility: row.visibility, href: "/office/calendar", status: row.status });
  for (const row of tasks.data ?? []) if (row.due_at) events.push({ id: `task:${row.id}`, source: "TASK", title: row.title, description: row.description, start_at: row.due_at, all_day: false, visibility: "SCOPED", href: `/office/tasks?focus=${row.id}`, status: row.status, priority: row.priority });
  for (const row of board.data ?? []) events.push({ id: `board:${row.id}`, source: "BOARD", title: `${row.meeting_kind} · ${row.title}`, description: [row.venue_mode, row.venue_details].filter(Boolean).join(" · "), start_at: row.scheduled_start, end_at: row.scheduled_end, all_day: false, visibility: "GOVERNANCE", href: `/office/governance?meeting=${row.id}`, status: row.status });
  for (const row of boardActions.data ?? []) if (row.due_at && !["DONE","CANCELLED"].includes(String(row.status))) events.push({ id: `board-action:${row.id}`, source: "BOARD_ACTION", title: row.title, description: row.description, start_at: row.due_at, all_day: false, visibility: canSeeGovernance ? "GOVERNANCE" : "OWN", href: `/office/governance?meeting=${row.meeting_id}`, status: row.status, priority: "HIGH" });
  for (const row of followups.data ?? []) if (row.due_at && !["CLOSED","NOT_REQUIRED"].includes(String(row.status))) events.push({ id: `secretarial:${row.id}`, source: "SECRETARIAL", title: `${row.authority} · ${row.title}`, description: [row.form_code, row.due_basis].filter(Boolean).join(" · "), start_at: row.due_at, all_day: false, visibility: canSeeGovernance ? "GOVERNANCE" : "OWN", href: `/office/governance?meeting=${row.meeting_id ?? ""}`, status: row.status, priority: "HIGH" });
  for (const row of compliance.data ?? []) if (row.due_date) events.push({ id: `compliance:${row.id}`, source: "COMPLIANCE", title: row.title, description: row.authority, start_at: row.due_date, all_day: true, visibility: "COMPLIANCE", href: "/office/compliance", status: row.status, priority: row.risk });
  for (const row of contracts.data ?? []) if (row.expiry_date) events.push({ id: `contract:${row.id}`, source: "CONTRACT", title: `${row.contract_no} · ${row.counterparty_name}`, description: row.notice_days ? `${row.notice_days} day notice recorded` : null, start_at: row.expiry_date, all_day: true, visibility: "LEGAL", href: "/office/contracts", status: row.status });
  for (const row of subscriptions.data ?? []) if (row.current_period_end) events.push({ id: `subscription:${row.id}`, source: "SUBSCRIPTION", title: "Subscription period end", description: `${row.customer_id} · ${row.product_id}${row.cancel_at_period_end ? " · cancellation scheduled" : ""}`, start_at: row.current_period_end, all_day: true, visibility: "COMMERCIAL", href: "/office/customers", status: row.status });

  events.sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  return { range: { start, end }, events, can_create_internal: true, disclaimer: "Projected dates come from canonical company records. Board quorum, statutory due dates and legal applicability are not calculated by the calendar." };
}

export async function createOfficeCalendarEvent(input: { title: string; description?: string; startAt: string; endAt?: string; allDay?: boolean; visibility: "PRIVATE" | "DEPARTMENT" | "COMPANY"; department?: string }) {
  const { admin, identity } = await actor();
  if (input.visibility === "DEPARTMENT" && !input.department && !identity.department) throw new OfficeCalendarError(400, "Department visibility requires a department");
  const { data, error } = await admin.rpc("office_create_calendar_event", {
    p_actor: identity.userId,
    p_title: input.title,
    p_description: input.description?.trim() || null,
    p_start_at: input.startAt,
    p_end_at: input.endAt ?? null,
    p_all_day: input.allDay ?? false,
    p_visibility: input.visibility,
    p_department: input.visibility === "DEPARTMENT" ? (input.department || identity.department) : null,
  });
  if (error || typeof data !== "string") throw new OfficeCalendarError(400, error?.message ?? "Unable to create calendar event");
  return { event_id: data };
}
