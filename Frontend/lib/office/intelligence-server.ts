import "server-only";

import { readOfficeRuntimeResult } from "@/lib/office/runtime-read-server";

import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";

export class OfficeIntelligenceError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeIntelligenceError";
  }
}

type Attention = {
  key: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
  area: string;
  title: string;
  detail: string;
  href: string;
};

type MoneyBucket = { currency: string; minor: number };

async function executiveActor() {
  try {
    const actor = await requireOfficeActor();
    if (!actor.identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR")) {
      throw new OfficeIntelligenceError(403, "Executive authority is required");
    }
    return actor;
  } catch (error) {
    if (error instanceof OfficeIntelligenceError) throw error;
    if (error instanceof OfficePermissionError) throw new OfficeIntelligenceError(error.status, error.message);
    throw error;
  }
}

function timestamp(value: unknown) {
  return typeof value === "string" ? Date.parse(value) : Number.NaN;
}

function numeric(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyBuckets(rows: Array<Record<string, unknown>>, amountField: string): MoneyBucket[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const currency = String(row.currency ?? "INR").trim().toUpperCase() || "INR";
    totals.set(currency, (totals.get(currency) ?? 0) + numeric(row[amountField]));
  }
  return Array.from(totals.entries())
    .map(([currency, minor]) => ({ currency, minor }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export async function getOfficeIntelligenceBrief() {
  const { admin } = await executiveActor();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const thirtyDays = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDays = new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString();

  const [tasks, approvals, incidents, opportunities, compliance, invoices, authSessions, accessReviews, notifications, contracts, services] = await Promise.all([
    admin.from("office_tasks").select("id,task_code,title,priority,status,due_at,assigned_user_id,department_code").in("status", ["OPEN", "IN_PROGRESS", "BLOCKED"]).order("due_at", { ascending: true, nullsFirst: false }).limit(300),
    admin.from("office_request_steps").select("id,request_id,label,status,assigned_user_id,created_at").eq("status", "PENDING").order("created_at", { ascending: true }).limit(300),
    admin.from("office_engineering_incidents").select("id,incident_code,severity,title,status,service_id,started_at").neq("status", "RESOLVED").order("started_at", { ascending: true }).limit(200),
    admin.from("office_crm_opportunities").select("id,opportunity_code,title,stage,value_minor,currency,expected_close_date,owner_user_id").not("stage", "in", "(WON,LOST)").order("expected_close_date", { ascending: true, nullsFirst: false }).limit(300),
    readOfficeRuntimeResult<Array<Record<string,unknown>>>("compliance").then((result)=>({
      ...result,
      data:(result.data??[]).filter((row)=>!["COMPLETED","CLOSED"].includes(String(row.status))&&Boolean(row.due_date)&&String(row.due_date)<=thirtyDays.slice(0,10)).sort((a,b)=>String(a.due_date||"").localeCompare(String(b.due_date||""))).slice(0,200),
    })),
    readOfficeRuntimeResult<Array<Record<string,unknown>>>("invoices").then((result)=>({
      ...result,
      data:(result.data??[]).filter((row)=>Number(row.balance_paise||0)>0).sort((a,b)=>String(a.due_date||"9999-12-31").localeCompare(String(b.due_date||"9999-12-31"))).slice(0,300),
    })),
    admin.from("office_auth_sessions").select("id,user_id,status,risk_level,last_seen_at,aal,mfa_verified").eq("status", "ACTIVE").order("last_seen_at", { ascending: false }).limit(300),
    admin.from("office_access_reviews").select("id,user_id,status,due_at").eq("status", "PENDING").order("due_at", { ascending: true }).limit(300),
    admin.from("office_notifications").select("id,user_id,kind,title,status,created_at").eq("status", "UNREAD").order("created_at", { ascending: false }).limit(300),
    readOfficeRuntimeResult<Array<Record<string,unknown>>>("contracts").then((result)=>({
      ...result,
      data:(result.data??[]).filter((row)=>Boolean(row.expiry_date)&&String(row.expiry_date)<=sixtyDays.slice(0,10)).sort((a,b)=>String(a.expiry_date||"").localeCompare(String(b.expiry_date||""))).slice(0,200),
    })),
    admin.from("office_engineering_services").select("id,service_code,name,environment,status,runtime_provider,updated_at").neq("status", "RETIRED").order("name", { ascending: true }).limit(200),
  ]);

  const results = [tasks, approvals, incidents, opportunities, compliance, invoices, authSessions, accessReviews, notifications, contracts, services];
  if (results.some((result) => result.error)) throw new OfficeIntelligenceError(503, "Company intelligence sources are temporarily unavailable");

  const taskRows = tasks.data ?? [];
  const approvalRows = approvals.data ?? [];
  const incidentRows = incidents.data ?? [];
  const opportunityRows = opportunities.data ?? [];
  const complianceRows = compliance.data ?? [];
  const invoiceRows = invoices.data ?? [];
  const authRows = authSessions.data ?? [];
  const reviewRows = accessReviews.data ?? [];
  const unreadRows = notifications.data ?? [];
  const contractRows = contracts.data ?? [];
  const serviceRows = services.data ?? [];

  const overdueTasks = taskRows.filter((row) => Number.isFinite(timestamp(row.due_at)) && timestamp(row.due_at) < now);
  const blockedTasks = taskRows.filter((row) => row.status === "BLOCKED");
  const criticalIncidents = incidentRows.filter((row) => row.severity === "SEV1" || row.severity === "SEV2");
  const overdueCompliance = complianceRows.filter((row) => Number.isFinite(timestamp(row.due_date)) && timestamp(row.due_date) < now);
  const overdueInvoices = invoiceRows.filter((row) => Number.isFinite(timestamp(row.due_date)) && timestamp(row.due_date) < now);
  const highRiskSessions = authRows.filter((row) => String(row.risk_level).toUpperCase() === "HIGH" || String(row.risk_level).toUpperCase() === "CRITICAL");
  const overdueAccessReviews = reviewRows.filter((row) => Number.isFinite(timestamp(row.due_at)) && timestamp(row.due_at) < now);
  const expiredContracts = contractRows.filter((row) => Number.isFinite(timestamp(row.expiry_date)) && timestamp(row.expiry_date) < now);
  const nonActiveServices = serviceRows.filter((row) => String(row.status).toUpperCase() !== "ACTIVE");
  const pipelineByCurrency = moneyBuckets(opportunityRows as Array<Record<string, unknown>>, "value_minor");
  const receivablesByCurrency = moneyBuckets(invoiceRows as Array<Record<string, unknown>>, "balance_paise");

  const attention: Attention[] = [];
  if (criticalIncidents.length) attention.push({ key: "critical-incidents", severity: "CRITICAL", area: "Engineering", title: `${criticalIncidents.length} high-severity incident${criticalIncidents.length === 1 ? "" : "s"} active`, detail: "SEV1/SEV2 incidents require explicit incident ownership and lifecycle action.", href: "/office/engineering" });
  if (highRiskSessions.length) attention.push({ key: "high-risk-sessions", severity: "CRITICAL", area: "Security", title: `${highRiskSessions.length} active high-risk authentication session${highRiskSessions.length === 1 ? "" : "s"}`, detail: "Review session context and revoke access if the session is not expected.", href: "/office/settings" });
  if (overdueCompliance.length) attention.push({ key: "compliance-overdue", severity: "HIGH", area: "Compliance", title: `${overdueCompliance.length} compliance obligation${overdueCompliance.length === 1 ? "" : "s"} past due`, detail: "This is based on stored due dates and status; it is not a legal conclusion about compliance.", href: "/office/compliance" });
  if (overdueInvoices.length) attention.push({ key: "invoices-overdue", severity: "HIGH", area: "Finance", title: `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? "" : "s"} with balance past due`, detail: "Receivable follow-up may be required; payment state remains governed by canonical finance records.", href: "/finance/billing" });
  if (overdueTasks.length) attention.push({ key: "tasks-overdue", severity: "HIGH", area: "Work", title: `${overdueTasks.length} active task${overdueTasks.length === 1 ? "" : "s"} past due`, detail: "Reassign, unblock or complete the affected Company Inbox work.", href: "/office/tasks" });
  if (expiredContracts.length) attention.push({ key: "contracts-expired", severity: "HIGH", area: "Legal", title: `${expiredContracts.length} stored contract${expiredContracts.length === 1 ? "" : "s"} past expiry date`, detail: "Review renewal, termination and evidence status before taking any contractual action.", href: "/office/contracts" });
  if (blockedTasks.length) attention.push({ key: "tasks-blocked", severity: "MEDIUM", area: "Work", title: `${blockedTasks.length} blocked task${blockedTasks.length === 1 ? "" : "s"}`, detail: "Each blocker has an explicit reason in the task ledger.", href: "/office/tasks" });
  if (approvalRows.length) attention.push({ key: "approvals", severity: "MEDIUM", area: "Approvals", title: `${approvalRows.length} approval step${approvalRows.length === 1 ? "" : "s"} pending`, detail: "Approval authority is evaluated independently from task ownership.", href: "/office/approvals" });
  if (overdueAccessReviews.length) attention.push({ key: "access-reviews", severity: "MEDIUM", area: "Security", title: `${overdueAccessReviews.length} access review${overdueAccessReviews.length === 1 ? "" : "s"} past due`, detail: "Review retained privilege and workforce access scope.", href: "/office/access" });
  if (nonActiveServices.length) attention.push({ key: "engineering-service-state", severity: "MEDIUM", area: "Engineering", title: `${nonActiveServices.length} registered service${nonActiveServices.length === 1 ? "" : "s"} not marked ACTIVE`, detail: "This reflects the Office service registry state and does not independently probe provider uptime.", href: "/office/engineering" });
  if (!attention.length) attention.push({ key: "no-material-exceptions", severity: "INFO", area: "Company", title: "No material exception triggered by current stored data", detail: "This means the deterministic checks above found no exception; it is not a guarantee that every system or obligation is healthy.", href: "/office/dashboard" });

  return {
    generated_at: nowIso,
    mode: "DETERMINISTIC_READ_MODEL",
    disclaimer: "This brief summarizes canonical Office records. It does not infer facts from missing data and does not execute company actions.",
    guardrail: "Read-only intelligence. KRAVIA Intelligence never executes payments, filings, deployments or other high-risk actions.",
    metrics: {
      active_tasks: taskRows.length,
      overdue_tasks: overdueTasks.length,
      blocked_tasks: blockedTasks.length,
      pending_approval_steps: approvalRows.length,
      active_incidents: incidentRows.length,
      critical_incidents: criticalIncidents.length,
      open_opportunities: opportunityRows.length,
      pipeline_by_currency: pipelineByCurrency,
      receivables_by_currency: receivablesByCurrency,
      invoices_with_balance: invoiceRows.length,
      compliance_due_30d: complianceRows.length,
      contracts_expiring_60d: contractRows.length,
      engineering_services: serviceRows.length,
      engineering_services_not_active: nonActiveServices.length,
      unread_notifications: unreadRows.length,
      active_auth_sessions: authRows.length,
      high_risk_auth_sessions: highRiskSessions.length,
    },
    attention,
  };
}
