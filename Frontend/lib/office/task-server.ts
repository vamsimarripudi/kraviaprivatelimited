import "server-only";

import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";

export class OfficeTaskError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeTaskError";
  }
}

type TaskInput = {
  assigneeUserId: string;
  title: string;
  description?: string;
  taskType?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  department?: string;
  sourceType?: string;
  sourceKey?: string;
  sourceRequestId?: string;
  dueAt?: string;
};

type TaskRow = Record<string, unknown> & { id: string };
type TaskEventRow = Record<string, unknown> & { task_id: string };

const TASK_SELECT = "id,task_code,title,description,task_type,priority,status,assigned_user_id,created_by,department_code,source_type,source_key,source_request_id,due_at,started_at,blocked_at,blocked_reason,completed_at,cancelled_at,created_at,updated_at" as const;

async function actor() {
  try {
    return await requireOfficeActor();
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeTaskError(error.status, error.message);
    throw error;
  }
}

export async function getOfficeTaskInbox() {
  const { admin, identity } = await actor();
  const privileged = identity.roles.some((role) => ["OWNER", "DIRECTOR", "ADMIN"].includes(role));

  const { data: reports, error: reportsError } = await admin
    .from("office_job_assignments")
    .select("user_id")
    .eq("reports_to_user_id", identity.userId)
    .eq("status", "ACTIVE");
  if (reportsError) throw new OfficeTaskError(503, "Unable to resolve reporting line");
  const reportIds = (reports ?? []).map((row) => row.user_id as string);
  const relevantUsers = Array.from(new Set([identity.userId, ...reportIds]));

  let query = admin.from("office_tasks").select(TASK_SELECT).order("created_at", { ascending: false }).limit(200);
  if (!privileged) query = query.or(`assigned_user_id.in.(${relevantUsers.join(",")}),created_by.eq.${identity.userId}`);
  const { data: tasks, error: tasksError } = await query;
  if (tasksError) throw new OfficeTaskError(503, "Unable to load Company Inbox tasks");
  const taskRows = (tasks ?? []) as TaskRow[];

  const taskIds = taskRows.map((task) => task.id);
  const { data: events, error: eventsError } = taskIds.length
    ? await admin.from("office_task_events").select("id,task_id,actor_user_id,event_type,note,previous_status,new_status,created_at").in("task_id", taskIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (eventsError) throw new OfficeTaskError(503, "Unable to load task history");

  let peopleQuery = admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status", "ACTIVE").order("display_name");
  if (!privileged) peopleQuery = peopleQuery.in("user_id", relevantUsers);
  const { data: people, error: peopleError } = await peopleQuery;
  if (peopleError) throw new OfficeTaskError(503, "Unable to load task assignees");

  const eventsByTask = new Map<string, TaskEventRow[]>();
  for (const event of (events ?? []) as TaskEventRow[]) {
    const current = eventsByTask.get(event.task_id) ?? [];
    current.push(event);
    eventsByTask.set(event.task_id, current);
  }

  return {
    actor: { user_id: identity.userId, roles: identity.roles },
    assignable_people: people ?? [],
    tasks: taskRows.map((task) => ({ ...task, events: eventsByTask.get(task.id) ?? [] })),
  };
}

export async function createOfficeTask(input: TaskInput) {
  const { admin, identity } = await actor();
  const { data, error } = await admin.rpc("office_create_task", {
    p_actor: identity.userId,
    p_assignee: input.assigneeUserId,
    p_title: input.title,
    p_description: input.description ?? "",
    p_task_type: input.taskType ?? "GENERAL",
    p_priority: input.priority ?? "NORMAL",
    p_department: input.department?.trim() || null,
    p_source_type: input.sourceType?.trim() || null,
    p_source_key: input.sourceKey?.trim() || null,
    p_source_request: input.sourceRequestId ?? null,
    p_due_at: input.dueAt ?? null,
  });
  if (error || typeof data !== "string") throw new OfficeTaskError(400, error?.message ?? "Unable to create task");
  return { task_id: data };
}

export async function transitionOfficeTask(input: { taskId: string; action: "START" | "BLOCK" | "COMPLETE" | "REOPEN" | "CANCEL"; note?: string }) {
  const { admin, identity } = await actor();
  const { data, error } = await admin.rpc("office_transition_task", {
    p_actor: identity.userId,
    p_task: input.taskId,
    p_action: input.action,
    p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeTaskError(400, error?.message ?? "Unable to update task");
  return { status: data };
}
