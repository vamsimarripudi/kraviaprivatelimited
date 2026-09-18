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

  const [identities, roles, jobs, profiles, devices, sessions, requests, steps, incidents, compliance, oncall, maintenance, retention, company] = await Promise.all([
    admin.from("office_identity_users").select("user_id,status,primary_department,authorization_version,access_review_due_at").order("created_at"),
    admin.from("office_user_roles").select("user_id,role,expires_at"),
    admin.from("office_job_assignments").select("user_id,status,department_code,position_code"),
    admin.from("office_user_access_profiles").select("user_id,status,expires_at"),
    admin.from("office_device_registry").select("id,user_id,trust_state,company_managed,last_seen_at"),
    admin.from("office_auth_sessions").select("id,user_id,status,aal,mfa_verified,risk_level,last_seen_at"),
    admin.from("office_requests").select("id,request_type_code,priority,status,due_at,created_at,updated_at"),
    admin.from("office_request_steps").select("id,request_id,status,assigned_user_id,created_at").eq("status", "PENDING"),
    admin.from("office_engineering_incidents").select("id,severity,status,started_at,updated_at"),
    readOfficeRuntimeResult<Array<Record<string,unknown>>>("compliance"),
    admin.from("office_oncall_rotations").select("id,service_id,primary_user_id,secondary_user_id,starts_at,ends_at,status"),
    admin.from("office_maintenance_windows").select("id,service_id,status,starts_at,ends_at,approved_at,verified_at"),
    admin.from("office_retention_rules").select("code,record_class,status,reviewed_at,effective_from,effective_to,source_reference"),
    readOfficeRuntimeResult<Record<string,unknown>>("company").then((result)=>({
      ...result,
      data:result.data?[result.data]:[],
    })),
  ]);
  const results = [identities, roles, jobs, profiles, devices, sessions, requests, steps, incidents, compliance, oncall, maintenance, retention, company];
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

  const oncallRows = oncall.data ?? [];
  const activeOncall = oncallRows.filter((row) => String(row.status).toUpperCase() === "ACTIVE" && timestamp(row.starts_at) <= now && (!Number.isFinite(timestamp(row.ends_at)) || timestamp(row.ends_at) >= now));
  const maintenanceRows = maintenance.data ?? [];
  const unverifiedMaintenance = maintenanceRows.filter((row) => ["COMPLETED", "EXECUTED"].includes(String(row.status).toUpperCase()) && !row.verified_at);
  const retentionRows = retention.data ?? [];
  const approvedRetention = retentionRows.filter((row) => String(row.status).toUpperCase() === "APPROVED");
  const expiredRetention = approvedRetention.filter((row) => Number.isFinite(timestamp(row.effective_to)) && timestamp(row.effective_to) < now);
  const unreviewedRetention = retentionRows.filter((row) => String(row.status).toUpperCase() !== "RETIRED" && !row.reviewed_at);
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
      key: "operations-coverage",
      area: "Operations",
      state: unverifiedMaintenance.length ? "ATTENTION" : activeOncall.length ? "READY" : "ATTENTION",
      title: "On-call and maintenance control coverage",
      detail: "Uses Office-owned rotation and maintenance evidence only. Runtime provider/integration alerts remain in the backend operations register.",
      evidence: [
        { label: "Recorded on-call rotations", value: oncallRows.length },
        { label: "Active rotations", value: activeOncall.length },
        { label: "Maintenance windows", value: maintenanceRows.length },
        { label: "Completed not verified", value: unverifiedMaintenance.length },
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
      key: "retention-governance",
      area: "Records",
      state: !approvedRetention.length || expiredRetention.length || unreviewedRetention.length ? "ATTENTION" : "READY",
      title: "Retention policy evidence",
      detail: "Shows only professionally reviewed retention records stored in Office. KRAVIA does not infer legal retention periods when no approved rule exists.",
      evidence: [
        { label: "Recorded rules", value: retentionRows.length },
        { label: "Approved rules", value: approvedRetention.length },
        { label: "Expired approved rules", value: expiredRetention.length },
        { label: "Unreviewed active/draft rules", value: unreviewedRetention.length },
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
