import "server-only";

import { getOfficeCrmOverview } from "@/lib/office/crm-server";
import { getOfficeEngineeringControlCenter } from "@/lib/office/engineering-server";
import { getOfficeTaskInbox } from "@/lib/office/task-server";
import { getKnowledgeHub } from "@/lib/office/knowledge-server";
import { getPortfolioOverview } from "@/lib/office/portfolio-server";
import { getOfficeWorkOverview } from "@/lib/office/workflow-server";

export class OfficeSearchError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeSearchError";
  }
}

export type OfficeSearchResult = {
  id: string;
  kind: "TASK" | "REQUEST" | "APPROVAL" | "LEAD" | "OPPORTUNITY" | "SERVICE" | "INCIDENT" | "POLICY" | "ANNOUNCEMENT" | "KNOWLEDGE" | "PROJECT" | "MILESTONE";
  label: string;
  meta: string;
  href: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function matches(query: string, ...values: unknown[]) {
  const haystack = values.map(text).join(" ").toLowerCase();
  return haystack.includes(query);
}

async function optional<T>(reader: () => Promise<T>): Promise<T | null> {
  try {
    return await reader();
  } catch {
    return null;
  }
}

export async function searchOffice(query: string): Promise<{ query: string; results: OfficeSearchResult[] }> {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return { query: normalized, results: [] };
  if (normalized.length > 80) throw new OfficeSearchError(400, "Search text is too long");

  const [tasks, work, crm, engineering, knowledge, portfolio] = await Promise.all([
    optional(() => getOfficeTaskInbox()),
    optional(() => getOfficeWorkOverview()),
    optional(() => getOfficeCrmOverview()),
    optional(() => getOfficeEngineeringControlCenter()),
    optional(() => getKnowledgeHub()),
    optional(() => getPortfolioOverview()),
  ]);

  const results: OfficeSearchResult[] = [];

  for (const row of (tasks?.tasks ?? []) as Array<Record<string, unknown>>) {
    if (!matches(normalized, row.task_code, row.title, row.description, row.status, row.priority)) continue;
    results.push({
      id: `task:${text(row.id)}`,
      kind: "TASK",
      label: text(row.title) || text(row.task_code),
      meta: `${text(row.task_code)} · ${text(row.status)}`,
      href: `/office/tasks?focus=${encodeURIComponent(text(row.id))}`,
    });
  }

  for (const row of (work?.requests ?? []) as Array<Record<string, unknown>>) {
    if (!matches(normalized, row.title, row.description, row.request_type_code, row.status)) continue;
    results.push({
      id: `request:${text(row.id)}`,
      kind: "REQUEST",
      label: text(row.title),
      meta: `${text(row.request_type_code)} · ${text(row.status)}`,
      href: `/office/requests?focus=${encodeURIComponent(text(row.id))}`,
    });
  }

  for (const entry of (work?.approvals ?? []) as Array<Record<string, unknown>>) {
    const request = (entry.request ?? null) as Record<string, unknown> | null;
    const step = (entry.step ?? null) as Record<string, unknown> | null;
    if (!request || !matches(normalized, request.title, request.request_type_code, step?.label, request.status)) continue;
    results.push({
      id: `approval:${text(step?.id ?? request.id)}`,
      kind: "APPROVAL",
      label: text(request.title),
      meta: `${text(step?.label)} · PENDING DECISION`,
      href: `/office/approvals?focus=${encodeURIComponent(text(request.id))}`,
    });
  }

  for (const row of (crm?.leads ?? []) as Array<Record<string, unknown>>) {
    if (!matches(normalized, row.lead_code, row.account_name, row.contact_name, row.stage, row.country)) continue;
    results.push({
      id: `lead:${text(row.id)}`,
      kind: "LEAD",
      label: text(row.account_name) || text(row.lead_code),
      meta: `${text(row.lead_code)} · ${text(row.stage)}`,
      href: `/office/crm?lead=${encodeURIComponent(text(row.id))}`,
    });
  }

  for (const row of (crm?.opportunities ?? []) as Array<Record<string, unknown>>) {
    if (!matches(normalized, row.opportunity_code, row.title, row.stage, row.next_step)) continue;
    results.push({
      id: `opportunity:${text(row.id)}`,
      kind: "OPPORTUNITY",
      label: text(row.title) || text(row.opportunity_code),
      meta: `${text(row.opportunity_code)} · ${text(row.stage)}`,
      href: `/office/crm?opportunity=${encodeURIComponent(text(row.id))}`,
    });
  }

  for (const row of (engineering?.services ?? []) as Array<Record<string, unknown>>) {
    if (!matches(normalized, row.service_code, row.name, row.project_key, row.repository_key, row.environment, row.status)) continue;
    results.push({
      id: `service:${text(row.id)}`,
      kind: "SERVICE",
      label: text(row.name) || text(row.service_code),
      meta: `${text(row.project_key)} · ${text(row.environment)}`,
      href: `/office/engineering?service=${encodeURIComponent(text(row.id))}`,
    });
  }

  for (const row of (engineering?.incidents ?? []) as Array<Record<string, unknown>>) {
    if (!matches(normalized, row.incident_code, row.title, row.summary, row.severity, row.status)) continue;
    results.push({
      id: `incident:${text(row.id)}`,
      kind: "INCIDENT",
      label: text(row.title) || text(row.incident_code),
      meta: `${text(row.incident_code)} · ${text(row.severity)} · ${text(row.status)}`,
      href: `/office/engineering?incident=${encodeURIComponent(text(row.id))}`,
    });
  }

  for (const row of (knowledge?.policies ?? []) as Array<Record<string, unknown>>) {
    if (!matches(normalized, row.policy_code, row.title, row.category, row.status)) continue;
    results.push({
      id: `policy:${text(row.id)}`,
      kind: "POLICY",
      label: text(row.title) || text(row.policy_code),
      meta: `${text(row.policy_code)} · ${text(row.category)} · ${text(row.status)}`,
      href: `/office/knowledge?policy=${encodeURIComponent(text(row.id))}`,
    });
  }

  for (const row of (knowledge?.announcements ?? []) as Array<Record<string, unknown>>) {
    if (!matches(normalized, row.announcement_code, row.title, row.body_text, row.announcement_type, row.priority)) continue;
    results.push({
      id: `announcement:${text(row.id)}`,
      kind: "ANNOUNCEMENT",
      label: text(row.title) || text(row.announcement_code),
      meta: `${text(row.announcement_type)} · ${text(row.priority)}`,
      href: `/office/knowledge?announcement=${encodeURIComponent(text(row.id))}`,
    });
  }

  for (const row of (knowledge?.articles ?? []) as Array<Record<string, unknown>>) {
    if (!matches(normalized, row.article_code, row.title, row.category, row.status)) continue;
    results.push({
      id: `knowledge:${text(row.id)}`,
      kind: "KNOWLEDGE",
      label: text(row.title) || text(row.article_code),
      meta: `${text(row.article_code)} · ${text(row.category)} · ${text(row.status)}`,
      href: `/office/knowledge?article=${encodeURIComponent(text(row.id))}`,
    });
  }

  for (const row of (portfolio?.projects ?? []) as Array<Record<string, unknown>>) {
    if (!matches(normalized, row.project_code, row.program_name, row.title, row.description, row.department_code, row.reported_health, row.status)) continue;
    results.push({
      id: `project:${text(row.id)}`,
      kind: "PROJECT",
      label: text(row.title) || text(row.project_code),
      meta: `${text(row.project_code)} · ${text(row.department_code)} · ${text(row.status)}`,
      href: `/office/portfolio?project=${encodeURIComponent(text(row.id))}`,
    });
  }

  for (const row of (portfolio?.milestones ?? []) as Array<Record<string, unknown>>) {
    if (!matches(normalized, row.milestone_code, row.title, row.description, row.status, row.blocked_reason, row.deliverable_reference)) continue;
    results.push({
      id: `milestone:${text(row.id)}`,
      kind: "MILESTONE",
      label: text(row.title) || text(row.milestone_code),
      meta: `${text(row.milestone_code)} · ${text(row.status)}`,
      href: `/office/portfolio?milestone=${encodeURIComponent(text(row.id))}`,
    });
  }

  const unique = new Map<string, OfficeSearchResult>();
  for (const result of results) if (!unique.has(result.id)) unique.set(result.id, result);
  return { query: normalized, results: Array.from(unique.values()).slice(0, 24) };
}
