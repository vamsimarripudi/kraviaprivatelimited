import "server-only";

import { OfficePermissionError, requireOfficeActor, resolveOfficePermission, type OfficePermissionDecision, type OfficeResourceScope } from "@/lib/office/permission-engine";

export class OfficeSecurityOverviewError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeSecurityOverviewError";
  }
}

type Authority = Awaited<ReturnType<typeof requireOfficeActor>> & { decision: OfficePermissionDecision; userIds: string[] | null };

async function authority(): Promise<Authority> {
  let current: Awaited<ReturnType<typeof requireOfficeActor>>;
  try { current = await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeSecurityOverviewError(error.status, error.message);
    throw error;
  }
  const candidates: OfficeResourceScope[] = [
    ...(current.identity.department ? [{ type: "DEPARTMENT" as const, key: current.identity.department }] : []),
    { type: "COMPANY" },
  ];
  let decision: OfficePermissionDecision | undefined;
  for (const resource of candidates) {
    const candidate = await resolveOfficePermission(current.admin, current.identity, "security.overview.read", resource);
    if (candidate.allowed) { decision = candidate; break; }
    decision = candidate;
  }
  if (!decision?.allowed) throw new OfficeSecurityOverviewError(403, decision?.reason ?? "Security overview permission is required");
  let userIds: string[] | null = null;
  if (decision.source !== "OWNER" && decision.scopeType === "DEPARTMENT") {
    const department = decision.scopeKey || current.identity.department;
    if (!department) userIds = [current.identity.userId];
    else {
      const { data, error } = await current.admin.from("office_identity_users").select("user_id").eq("primary_department", department);
      if (error) throw new OfficeSecurityOverviewError(503, "Unable to resolve security department scope");
      userIds = (data ?? []).map((row) => String(row.user_id));
    }
  }
  return { ...current, decision, userIds };
}

function scopeUsers<T>(query: T, column: string, userIds: string[] | null) {
  if (!userIds) return query;
  return (query as T & { in: (name: string, values: string[]) => T }).in(column, userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
}

export async function getOfficeSecurityOverview() {
  const read = await authority();
  let sessionsQuery = read.admin.from("office_auth_sessions").select("id,user_id,device_id,status,aal,mfa_verified,risk_level,ip_address,user_agent_summary,started_at,last_seen_at,ended_at,end_reason").order("last_seen_at", { ascending: false }).limit(200);
  let devicesQuery = read.admin.from("office_device_registry").select("id,user_id,device_label,device_kind,platform,trust_state,company_managed,approved_at,revoked_at,last_seen_at,created_at").order("last_seen_at", { ascending: false }).limit(200);
  let authEventsQuery = read.admin.from("office_auth_events").select("id,event_id,session_id,user_id,event_type,aal,ip_address,metadata,created_at").order("created_at", { ascending: false }).limit(250);
  let incidentsQuery = read.admin.from("office_engineering_incidents").select("id,incident_code,service_id,severity,title,summary,status,owner_user_id,started_at,resolved_at,created_at,updated_at").order("updated_at", { ascending: false }).limit(150);
  sessionsQuery = scopeUsers(sessionsQuery, "user_id", read.userIds);
  devicesQuery = scopeUsers(devicesQuery, "user_id", read.userIds);
  authEventsQuery = scopeUsers(authEventsQuery, "user_id", read.userIds);
  incidentsQuery = scopeUsers(incidentsQuery, "owner_user_id", read.userIds);

  let auditQuery = read.admin.from("office_access_audit").select("id,actor_user_id,actor_roles,target_user_id,target_email,action,role,department,reason,metadata,created_at").order("created_at", { ascending: false }).limit(200);
  if (read.userIds) {
    const ids = read.userIds.length ? read.userIds : ["00000000-0000-0000-0000-000000000000"];
    auditQuery = auditQuery.or(`actor_user_id.in.(${ids.join(",")}),target_user_id.in.(${ids.join(",")})`);
  }
  let peopleQuery = read.admin.from("office_identity_users").select("user_id,status,display_name,job_title,primary_department,authorization_version,access_review_due_at").order("display_name");
  peopleQuery = scopeUsers(peopleQuery, "user_id", read.userIds);

  const [sessions, devices, authEvents, incidents, audit, people] = await Promise.all([sessionsQuery, devicesQuery, authEventsQuery, incidentsQuery, auditQuery, peopleQuery]);
  if (sessions.error || devices.error || authEvents.error || incidents.error || audit.error || people.error) throw new OfficeSecurityOverviewError(503, "Security observability records are temporarily unavailable");

  const sessionRows = sessions.data ?? [];
  const deviceRows = devices.data ?? [];
  const incidentRows = incidents.data ?? [];
  const activeSessions = sessionRows.filter((row) => row.status === "ACTIVE");
  return {
    actor: { user_id: read.identity.userId, roles: read.identity.roles, department: read.identity.department ?? null },
    scope: { source: read.decision.source ?? null, type: read.decision.scopeType ?? null, key: read.decision.scopeKey ?? null },
    summary: {
      active_sessions: activeSessions.length,
      active_without_aal2: activeSessions.filter((row) => row.aal !== "aal2" || row.mfa_verified !== true).length,
      elevated_risk_sessions: activeSessions.filter((row) => ["HIGH", "BLOCKED"].includes(String(row.risk_level))).length,
      pending_devices: deviceRows.filter((row) => row.trust_state === "PENDING").length,
      trusted_managed_devices: deviceRows.filter((row) => row.trust_state === "TRUSTED" && row.company_managed === true).length,
      open_incidents: incidentRows.filter((row) => !["RESOLVED", "CLOSED"].includes(String(row.status))).length,
    },
    people: people.data ?? [],
    sessions: sessionRows,
    devices: deviceRows,
    auth_events: authEvents.data ?? [],
    incidents: incidentRows,
    access_audit: audit.data ?? [],
    disclaimer: "Security observability is limited to authentication, device, access-control and incident records. KRAVIA Office does not capture keystrokes, screenshots or continuous employee surveillance.",
  };
}
