import "server-only";

import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";

export class OfficeReadinessError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeReadinessError";
  }
}

type GateState = "READY" | "ATTENTION" | "BLOCKED";
type Gate = { key: string; area: string; state: GateState; title: string; detail: string; evidence: Array<{ label: string; value: number | string }> };

async function executiveActor() {
  try {
    const actor = await requireOfficeActor();
    if (!actor.identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR")) throw new OfficeReadinessError(403, "Executive readiness authority is required");
    return actor;
  } catch (error) {
    if (error instanceof OfficeReadinessError) throw error;
    if (error instanceof OfficePermissionError) throw new OfficeReadinessError(error.status, error.message);
    throw error;
  }
}

function timestamp(value: unknown) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
function openStatus(value: unknown) { return !["COMPLETED", "CLOSED", "RESOLVED", "REJECTED", "CANCELLED", "FULFILLED", "EXPIRED"].includes(String(value).toUpperCase()); }

export async function getOfficeReadiness() {
  const { admin } = await executiveActor();
  const now = Date.now();
  const seventyTwoHoursAgo = now - 72 * 60 * 60 * 1000;

  const [identities, roles, jobs, profiles, devices, sessions, requests, steps, incidents, compliance, integrations, alerts, company] = await Promise.all([
    admin.from("office_identity_users").select("user_id,status,primary_department,authorization_version,access_review_due_at").order("created_at"),
    admin.from("office_user_roles").select("user_id,role,expires_at"),
    admin.from("office_job_assignments").select("user_id,status,department_code,position_code"),
    admin.from("office_user_access_profiles").select("user_id,status,expires_at"),
    admin.from("office_device_registry").select("id,user_id,trust_state,company_managed,last_seen_at"),
    admin.from("office_auth_sessions").select("id,user_id,status,aal,mfa_verified,risk_level,last_seen_at"),
    admin.from("office_requests").select("id,request_type_code,priority,status,due_at,created_at,updated_at"),
    admin.from("office_request_steps").select("id,request_id,status,assigned_user_id,created_at").eq("status", "PENDING"),
    admin.from("office_engineering_incidents").select("id,severity,status,started_at,updated_at"),
    admin.from("compliance_obligations").select("id,title,authority,status,due_date,risk,evidence_ref"),
    admin.from("integration_registry").select("id,provider,integration_type,environment,status,last_verified_at"),
    admin.from("operational_alerts").select("id,category,severity,title,status,due_date,created_at,resolved_at"),
    admin.from("legal_entities").select("id,legal_name,cin,status,source_ref").limit(5),
  ]);
  const results = [identities, roles, jobs, profiles, devices, sessions, requests, steps, incidents, compliance, integrations, alerts, company];
  if (results.some((result) => result.error)) throw new OfficeReadinessError(503, "Readiness evidence sources are temporarily unavailable");

  const identityRows = identities.data ?? [];
  const activeIds = new Set(identityRows.filter((row) => row.status === "ACTIVE").map((row) => String(row.user_id)));
  const activeRoleIds = new Set((roles.data ?? []).filter((row) => activeIds.has(String(row.user_id)) && (!row.expires_at || timestamp(row.expires_at) > now)).map((row) => String(row.user_id)));
  const activeJobIds = new Set((jobs.data ?? []).filter((row) => activeIds.has(String(row.user_id)) && ["ACTIVE", "ON_LEAVE"].includes(String(row.status))).map((row) => String(row.user_id)));
  const activeProfileIds = new Set((profiles.data ?? []).filter((row) => activeIds.has(String(row.user_id)) && row.status === "ACTIVE" && (!row.expires_at || timestamp(row.expires_at) > now)).map((row) => String(row.user_id)));
  const overdueReviews = identityRows.filter((row) => row.status === "ACTIVE" && Number.isFinite(timestamp(row.access_review_due_at)) && timestamp(row.access_review_due_at) < now);
  const unassignedJobs = Array.from(activeIds).filter((id) => !activeJobIds.has(id));
  const noRoles = Array.from(activeIds).filter((id) => !activeRoleIds.has(id));
  const noProfiles = Array.from(activeIds).filter((id) => !activeProfileIds.has(id));

  const sessionRows = sessions.data ?? [];
  const activeSessions = sessionRows.filter((row) => row.status === "ACTIVE");
  const noAal2 = activeSessions.filter((row) => row.aal !== "aal2" || row.mfa_verified !== true);
  const elevatedRisk = activeSessions.filter((row) => ["HIGH", "BLOCKED", "CRITICAL"].includes(String(row.risk_level).toUpperCase()));
  const pendingDevices = (devices.data ?? []).filter((row) => row.trust_state === "PENDING");
  const openIncidents = (incidents.data ?? []).filter((row) => openStatus(row.status));
  const severeIncidents = openIncidents.filter((row) => ["SEV1", "SEV2", "CRITICAL", "HIGH"].includes(String(row.severity).toUpperCase()));

  const requestRows = (requests.data ?? []).filter((row) => openStatus(row.status));
  const overdueRequests = requestRows.filter((row) => Number.isFinite(timestamp(row.due_at)) && timestamp(row.due_at) < now);
  const overdueCriticalRequests = overdueRequests.filter((row) => ["HIGH", "URGENT"].includes(String(row.priority)));
  const staleSteps = (steps.data ?? []).filter((row) => timestamp(row.created_at) < seventyTwoHoursAgo);

  const complianceRows = compliance.data ?? [];
  const openCompliance = complianceRows.filter((row) => openStatus(row.status));
  const overdueCompliance = openCompliance.filter((row) => Number.isFinite(timestamp(row.due_date)) && timestamp(row.due_date) < now);
  const missingEvidence = openCompliance.filter((row) => !row.evidence_ref);

  const integrationRows = integrations.data ?? [];
  const integrationAttention = integrationRows.filter((row) => !["ACTIVE", "VERIFIED", "READY"].includes(String(row.status).toUpperCase()));
  const staleIntegrations = integrationRows.filter((row) => !row.last_verified_at || now - timestamp(row.last_verified_at) > 30 * 24 * 60 * 60 * 1000);
  const activeAlerts = (alerts.data ?? []).filter((row) => openStatus(row.status));
  const criticalAlerts = activeAlerts.filter((row) => ["CRITICAL", "HIGH"].includes(String(row.severity).toUpperCase()));
  const companyRows = company.data ?? [];

  const gates: Gate[] = [
    {
      key: "identity-authority",
      area: "Identity",
      state: noRoles.length ? "BLOCKED" : unassignedJobs.length || overdueReviews.length || noProfiles.length ? "ATTENTION" : "READY",
      title: "Workforce identity and authority",
      detail: "Active identities should have an accountable job context, active authority and periodic access review.",
      evidence: [
        { label: "Active identities", value: activeIds.size },
        { label: "Without active role", value: noRoles.length },
        { label: "Without active job", value: unassignedJobs.length },
        { label: "Without access profile", value: noProfiles.length },
        { label: "Access reviews past due", value: overdueReviews.length },
      ],
    },
    {
      key: "security-control",
      area: "Security",
      state: elevatedRisk.length || severeIncidents.length ? "BLOCKED" : noAal2.length || pendingDevices.length ? "ATTENTION" : "READY",
      title: "Authentication and incident posture",
      detail: "Derived from current Office authentication, trusted-device and engineering incident records.",
      evidence: [
        { label: "Active sessions", value: activeSessions.length },
        { label: "Active without AAL2", value: noAal2.length },
        { label: "Elevated-risk sessions", value: elevatedRisk.length },
        { label: "Pending devices", value: pendingDevices.length },
        { label: "Severe open incidents", value: severeIncidents.length },
      ],
    },
    {
      key: "workflow-control",
      area: "Workflow",
      state: overdueCriticalRequests.length ? "BLOCKED" : overdueRequests.length || staleSteps.length ? "ATTENTION" : "READY",
      title: "Requests and approval queues",
      detail: "Flags overdue governed work and approval steps; it does not execute or auto-approve them.",
      evidence: [
        { label: "Open requests", value: requestRows.length },
        { label: "Overdue requests", value: overdueRequests.length },
        { label: "Overdue high/urgent", value: overdueCriticalRequests.length },
        { label: "Pending steps >72h", value: staleSteps.length },
      ],
    },
    {
      key: "compliance-register",
      area: "Compliance",
      state: overdueCompliance.length ? "ATTENTION" : !complianceRows.length || missingEvidence.length ? "ATTENTION" : "READY",
      title: "Stored compliance obligation register",
      detail: "Uses only recorded due dates, status and evidence references. It is not a legal conclusion that obligations are complete or applicable.",
      evidence: [
        { label: "Recorded obligations", value: complianceRows.length },
        { label: "Open obligations", value: openCompliance.length },
        { label: "Past stored due date", value: overdueCompliance.length },
        { label: "Open without evidence ref", value: missingEvidence.length },
      ],
    },
    {
      key: "integration-register",
      area: "Integrations",
      state: integrationAttention.length || staleIntegrations.length ? "ATTENTION" : integrationRows.length ? "READY" : "ATTENTION",
      title: "Integration registry verification",
      detail: "Reflects registry state and verification timestamps; it does not independently probe provider uptime.",
      evidence: [
        { label: "Registered integrations", value: integrationRows.length },
        { label: "Non-ready registry state", value: integrationAttention.length },
        { label: "Not verified in 30 days", value: staleIntegrations.length },
      ],
    },
    {
      key: "company-master",
      area: "Corporate",
      state: companyRows.length ? "READY" : "BLOCKED",
      title: "Controlled company master present",
      detail: "Confirms only that a canonical legal-entity record exists. Verification status remains visible rather than inferred.",
      evidence: [
        { label: "Legal entity records", value: companyRows.length },
        { label: "Recorded status", value: companyRows[0]?.status ? String(companyRows[0].status) : "MISSING" },
      ],
    },
    {
      key: "operational-alerts",
      area: "Operations",
      state: criticalAlerts.length ? "BLOCKED" : activeAlerts.length ? "ATTENTION" : "READY",
      title: "Operational exception register",
      detail: "Current alerts are surfaced as exceptions and remain owned by their underlying system of record.",
      evidence: [
        { label: "Active alerts", value: activeAlerts.length },
        { label: "High / critical alerts", value: criticalAlerts.length },
      ],
    },
    {
      key: "server-configuration",
      area: "Configuration",
      state: process.env.OFFICE_SUPABASE_URL && process.env.OFFICE_SUPABASE_SECRET_KEY ? "READY" : "BLOCKED",
      title: "Trusted Office server configuration",
      detail: "Reports only whether required server-side configuration exists. Secret values are never returned.",
      evidence: [
        { label: "Office auth configured", value: Boolean(process.env.OFFICE_SUPABASE_URL && process.env.OFFICE_SUPABASE_PUBLISHABLE_KEY) ? "YES" : "NO" },
        { label: "Office service authority configured", value: Boolean(process.env.OFFICE_SUPABASE_SECRET_KEY) ? "YES" : "NO" },
        { label: "Backend origin configured", value: Boolean(process.env.OFFICE_API_ORIGIN) ? "YES" : "NO" },
        { label: "Managed-device enforcement", value: process.env.OFFICE_DEVICE_ENFORCEMENT?.toLowerCase() === "true" ? "ENABLED" : "NOT ENFORCED" },
      ],
    },
  ];

  const blocked = gates.filter((gate) => gate.state === "BLOCKED").length;
  const attention = gates.filter((gate) => gate.state === "ATTENTION").length;
  return {
    generated_at: new Date().toISOString(),
    summary: { gates: gates.length, blocked, attention, ready: gates.length - blocked - attention },
    gates,
    disclaimer: "Readiness is an evidence dashboard, not a compliance certificate, legal opinion or uptime guarantee. Missing data is surfaced as missing or attention rather than assumed healthy.",
  };
}
