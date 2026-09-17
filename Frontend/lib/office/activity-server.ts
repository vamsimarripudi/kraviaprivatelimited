import "server-only";

import { getOfficeCrmOverview } from "@/lib/office/crm-server";
import { getOfficeEngineeringControlCenter } from "@/lib/office/engineering-server";
import { getOfficeTaskInbox } from "@/lib/office/task-server";
import { getOfficeWorkOverview } from "@/lib/office/workflow-server";

export type OfficeActivityItem = {
  id: string;
  area: "WORK" | "REQUEST" | "CRM" | "ENGINEERING" | "SECURITY";
  kind: string;
  title: string;
  detail: string;
  occurred_at: string;
  href: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function timestamp(value: unknown) {
  const raw = text(value);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function optional<T>(reader: () => Promise<T>): Promise<T | null> {
  try {
    return await reader();
  } catch {
    return null;
  }
}

export async function getOfficeActivityTimeline(limit = 120) {
  const safeLimit = Math.max(20, Math.min(250, Math.trunc(limit || 120)));
  const [tasks, work, crm, engineering] = await Promise.all([
    optional(() => getOfficeTaskInbox()),
    optional(() => getOfficeWorkOverview()),
    optional(() => getOfficeCrmOverview()),
    optional(() => getOfficeEngineeringControlCenter()),
  ]);
  const items: OfficeActivityItem[] = [];

  for (const task of (tasks?.tasks ?? []) as Array<Record<string, unknown>>) {
    const taskId = text(task.id);
    for (const event of (task.events ?? []) as Array<Record<string, unknown>>) {
      items.push({
        id: `task-event:${text(event.id)}`,
        area: "WORK",
        kind: text(event.event_type) || "TASK_EVENT",
        title: text(task.title) || text(task.task_code),
        detail: [text(event.previous_status), text(event.new_status)].filter(Boolean).join(" → ") || text(event.note) || "Task activity",
        occurred_at: text(event.created_at),
        href: `/office/tasks?focus=${encodeURIComponent(taskId)}`,
      });
    }
    if (!Array.isArray(task.events) || !task.events.length) {
      items.push({
        id: `task:${taskId}`,
        area: "WORK",
        kind: "TASK",
        title: text(task.title) || text(task.task_code),
        detail: `${text(task.status)} · ${text(task.priority)}`,
        occurred_at: text(task.updated_at || task.created_at),
        href: `/office/tasks?focus=${encodeURIComponent(taskId)}`,
      });
    }
  }

  for (const request of (work?.requests ?? []) as Array<Record<string, unknown>>) {
    const id = text(request.id);
    items.push({
      id: `request:${id}`,
      area: "REQUEST",
      kind: text(request.request_type_code) || "REQUEST",
      title: text(request.title),
      detail: `${text(request.status)} · ${text(request.priority)}`,
      occurred_at: text(request.updated_at || request.created_at),
      href: `/office/requests?focus=${encodeURIComponent(id)}`,
    });
  }

  for (const entry of (work?.approvals ?? []) as Array<Record<string, unknown>>) {
    const request = (entry.request ?? null) as Record<string, unknown> | null;
    const step = (entry.step ?? null) as Record<string, unknown> | null;
    if (!request || !step) continue;
    items.push({
      id: `approval:${text(step.id)}`,
      area: "REQUEST",
      kind: "APPROVAL_PENDING",
      title: text(request.title),
      detail: text(step.label) || "Approval decision pending",
      occurred_at: text(step.created_at || request.updated_at),
      href: `/office/approvals?focus=${encodeURIComponent(text(request.id))}`,
    });
  }

  for (const activity of (crm?.activities ?? []) as Array<Record<string, unknown>>) {
    const parent = text(activity.opportunity_id || activity.lead_id);
    items.push({
      id: `crm:${text(activity.id)}`,
      area: "CRM",
      kind: text(activity.activity_type) || "CRM_ACTIVITY",
      title: text(activity.subject) || "Commercial activity",
      detail: text(activity.body),
      occurred_at: text(activity.occurred_at || activity.created_at),
      href: `/office/crm?focus=${encodeURIComponent(parent)}`,
    });
  }

  for (const event of (engineering?.incident_events ?? []) as Array<Record<string, unknown>>) {
    items.push({
      id: `incident-event:${text(event.id)}`,
      area: "ENGINEERING",
      kind: text(event.action) || "INCIDENT_EVENT",
      title: `Incident ${text(event.incident_id).slice(0, 8)}`,
      detail: [text(event.previous_status), text(event.new_status), text(event.note)].filter(Boolean).join(" · "),
      occurred_at: text(event.created_at),
      href: `/office/engineering?incident=${encodeURIComponent(text(event.incident_id))}`,
    });
  }

  for (const deployment of (engineering?.deployments ?? []) as Array<Record<string, unknown>>) {
    items.push({
      id: `deployment:${text(deployment.id)}`,
      area: "ENGINEERING",
      kind: "DEPLOYMENT",
      title: `${text(deployment.provider)} deployment`,
      detail: `${text(deployment.environment)} · ${text(deployment.status)} · ${text(deployment.git_sha).slice(0, 10)}`,
      occurred_at: text(deployment.finished_at || deployment.started_at || deployment.created_at),
      href: `/office/engineering?deployment=${encodeURIComponent(text(deployment.id))}`,
    });
  }

  for (const notification of (work?.notifications ?? []) as Array<Record<string, unknown>>) {
    if (!text(notification.kind).toUpperCase().includes("SECURITY")) continue;
    items.push({
      id: `notification:${text(notification.id)}`,
      area: "SECURITY",
      kind: text(notification.kind),
      title: text(notification.title),
      detail: text(notification.body),
      occurred_at: text(notification.created_at),
      href: "/office/notifications",
    });
  }

  return {
    generated_at: new Date().toISOString(),
    disclaimer: "This timeline merges only records already visible to the signed-in actor through their domain read models. It is not a bypass around record authorization.",
    items: items.filter((item) => timestamp(item.occurred_at) > 0).sort((a, b) => timestamp(b.occurred_at) - timestamp(a.occurred_at)).slice(0, safeLimit),
  };
}
