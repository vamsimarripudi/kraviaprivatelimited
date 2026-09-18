import "server-only";

import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

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

function projected(source: string, sourceKey: string, title: string, startsAt: string | null, eventType: string, description: string, endsAt: string | null = null) {
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
    ends_at: endsAt,
    all_day: eventType === "DEADLINE" || eventType === "CUSTOMER",
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
  const trustedDeviceId = await currentOfficeTrustedDeviceId(admin, identity.userId);
  const [resiliencePermission, insurancePermission, domainPermission, custodyPermission, strategyPermission, qualityCompanyPermission, qualityDepartmentPermission, qualityOwnPermission, portfolioCompanyPermission, portfolioDepartmentPermission, portfolioMemberPermission] = await Promise.all([
    resolveOfficePermission(admin, identity, "resilience.read", { type: "COMPANY" }, trustedDeviceId),
    resolveOfficePermission(admin, identity, "insurance.read", { type: "COMPANY" }, trustedDeviceId),
    resolveOfficePermission(admin, identity, "infra.domain.read", { type: "COMPANY" }, trustedDeviceId),
    resolveOfficePermission(admin, identity, "custody.read", { type: "COMPANY" }, trustedDeviceId),
    resolveOfficePermission(admin, identity, "strategy.read", { type: "COMPANY" }, trustedDeviceId),
    resolveOfficePermission(admin, identity, "quality.read", { type: "COMPANY" }, trustedDeviceId),
    identity.department
      ? resolveOfficePermission(admin, identity, "quality.read", { type: "DEPARTMENT", key: identity.department }, trustedDeviceId)
      : Promise.resolve({ allowed: false } as const),
    resolveOfficePermission(admin, identity, "quality.read", { type: "OWN", key: identity.userId, ownerUserId: identity.userId }, trustedDeviceId),
    resolveOfficePermission(admin, identity, "portfolio.read", { type: "COMPANY" }, trustedDeviceId),
    identity.department
      ? resolveOfficePermission(admin, identity, "portfolio.read", { type: "DEPARTMENT", key: identity.department }, trustedDeviceId)
      : Promise.resolve({ allowed: false } as const),
    resolveOfficePermission(admin, identity, "portfolio.member.read", { type: "OWN", key: identity.userId, ownerUserId: identity.userId }, trustedDeviceId),
  ]);
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

  const taskEvents = (tasksResult.data ?? [])
    .filter((task) => privileged || task.assigned_user_id === identity.userId || task.created_by === identity.userId)
    .map((task) => projected("TASK", String(task.id), `Task due · ${task.title}`, dateIso(task.due_at), "DEADLINE", task.description || task.task_code || "Company Inbox task due date"))
    .filter(Boolean);

  const synthetic: Array<Record<string, unknown>> = [...taskEvents] as Array<Record<string, unknown>>;

  const [ownOncall, ownMaintenance] = await Promise.all([
    admin.from("office_oncall_rotations")
      .select("id,rotation_code,service_id,primary_user_id,secondary_user_id,starts_at,ends_at,status")
      .or("primary_user_id.eq."+identity.userId+",secondary_user_id.eq."+identity.userId)
      .eq("status","SCHEDULED")
      .order("starts_at",{ascending:true}).limit(150),
    admin.from("office_maintenance_windows")
      .select("id,maintenance_code,service_id,title,expected_impact,starts_at,ends_at,status,owner_user_id")
      .eq("owner_user_id",identity.userId)
      .in("status",["PROPOSED","APPROVED","IN_PROGRESS"])
      .order("starts_at",{ascending:true}).limit(150),
  ]);
  if (ownOncall.error || ownMaintenance.error) throw new OfficeCalendarError(503, "Engineering operations calendar is temporarily unavailable");
  const engineeringServiceIds = Array.from(new Set([
    ...(ownOncall.data ?? []).map((row) => String(row.service_id)),
    ...(ownMaintenance.data ?? []).map((row) => String(row.service_id)),
  ]));
  const engineeringServices = engineeringServiceIds.length
    ? await admin.from("office_engineering_services").select("id,service_code,name,project_key,environment").in("id", engineeringServiceIds)
    : { data: [], error: null };
  if (engineeringServices.error) throw new OfficeCalendarError(503, "Engineering service calendar is temporarily unavailable");
  const engineeringServiceMap = new Map((engineeringServices.data ?? []).map((row) => [String(row.id), row]));
  for (const row of ownOncall.data ?? []) {
    const service = engineeringServiceMap.get(String(row.service_id));
    const role = row.primary_user_id === identity.userId ? "Primary" : "Secondary";
    const event = projected("ON_CALL", String(row.id), "On-call · "+(service?.name ?? row.rotation_code), dateIso(row.starts_at), "REMINDER", [row.rotation_code, role, service?.project_key, service?.environment].filter(Boolean).join(" · "), dateIso(row.ends_at));
    if (event) synthetic.push(event);
  }
  for (const row of ownMaintenance.data ?? []) {
    const service = engineeringServiceMap.get(String(row.service_id));
    const event = projected("MAINTENANCE", String(row.id), "Maintenance · "+row.title, dateIso(row.starts_at), "MAINTENANCE", [row.maintenance_code, service?.name, row.status, row.expected_impact].filter(Boolean).join(" · "), dateIso(row.ends_at));
    if (event) synthetic.push(event);
  }

  if (compliance) {
    const { data, error } = await admin.from("compliance_obligations").select("id,title,authority,due_date,status,risk").not("due_date", "is", null).order("due_date", { ascending: true }).limit(250);
    if (error) throw new OfficeCalendarError(503, "Compliance calendar is temporarily unavailable");
    for (const row of data ?? []) {
      const event = projected("COMPLIANCE", String(row.id), `Compliance · ${row.title}`, dateIso(row.due_date), "DEADLINE", `${row.authority} · ${row.status}${row.risk ? ` · ${row.risk}` : ""}`);
      if (event) synthetic.push(event);
    }
  }

  if (governance) {
    const [meetings, actions, followups] = await Promise.all([
      admin.from("office_board_meetings").select("id,meeting_code,meeting_kind,title,scheduled_start,scheduled_end,status").order("scheduled_start", { ascending: true }).limit(150),
      admin.from("office_board_actions").select("id,action_code,meeting_id,title,description,owner_user_id,due_at,status").not("due_at", "is", null).order("due_at", { ascending: true }).limit(300),
      admin.from("office_secretarial_followups").select("id,followup_code,meeting_id,title,authority,form_code,due_at,due_basis,owner_user_id,reviewer_user_id,status").not("due_at", "is", null).order("due_at", { ascending: true }).limit(300),
    ]);
    if (meetings.error || actions.error || followups.error) throw new OfficeCalendarError(503, "Governance calendar is temporarily unavailable");
    for (const row of meetings.data ?? []) {
      const event = projected("BOARD_MEETING", String(row.id), `Board · ${row.title}`, dateIso(row.scheduled_start), "MEETING", `${row.meeting_code} · ${row.meeting_kind} · ${row.status}`, dateIso(row.scheduled_end));
      if (event) synthetic.push(event);
    }
    for (const row of actions.data ?? []) {
      if (["DONE", "CANCELLED"].includes(String(row.status))) continue;
      const event = projected("BOARD_ACTION", String(row.id), `Board action · ${row.title}`, dateIso(row.due_at), "DEADLINE", `${row.action_code} · ${row.status}`);
      if (event) synthetic.push(event);
    }
    for (const row of followups.data ?? []) {
      if (["CLOSED", "NOT_REQUIRED"].includes(String(row.status))) continue;
      const event = projected("SECRETARIAL", String(row.id), `${row.authority} · ${row.title}`, dateIso(row.due_at), "DEADLINE", [row.followup_code, row.form_code, row.due_basis, row.status].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
  }

  if (legalOps) {
    const [contracts, obligations] = await Promise.all([
      admin.from("contracts").select("id,contract_no,counterparty_name,expiry_date,status").not("expiry_date", "is", null).order("expiry_date", { ascending: true }).limit(150),
      admin.from("office_contract_obligations").select("id,obligation_code,contract_id,title,obligation_type,owner_user_id,cadence,next_due_at,status").eq("status", "ACTIVE").not("next_due_at", "is", null).order("next_due_at", { ascending: true }).limit(300),
    ]);
    if (contracts.error || obligations.error) throw new OfficeCalendarError(503, "Contract calendar is temporarily unavailable");
    const contractMap = new Map((contracts.data ?? []).map((row) => [String(row.id), row]));
    for (const row of contracts.data ?? []) {
      const event = projected("CONTRACT", String(row.id), `Contract expiry · ${row.counterparty_name}`, dateIso(row.expiry_date, true), "DEADLINE", `${row.contract_no} · ${row.status}`);
      if (event) synthetic.push(event);
    }
    for (const row of obligations.data ?? []) {
      const contract = contractMap.get(String(row.contract_id));
      const event = projected("CONTRACT_OBLIGATION", String(row.id), `Contract duty · ${row.title}`, dateIso(row.next_due_at), "DEADLINE", [row.obligation_code, row.obligation_type, contract?.contract_no, row.cadence].filter(Boolean).join(" · "));
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

  if (resiliencePermission.allowed) {
    const [plans, tests] = await Promise.all([
      admin.from("office_continuity_plans").select("id,plan_code,title,plan_type,next_test_on,status").in("status", ["APPROVED","ACTIVE"]).not("next_test_on", "is", null).order("next_test_on", { ascending: true }).limit(200),
      admin.from("office_resilience_tests").select("id,test_code,plan_id,test_type,scheduled_on,status").in("status", ["PLANNED","IN_PROGRESS","AWAITING_REVIEW"]).order("scheduled_on", { ascending: true }).limit(300),
    ]);
    if (plans.error || tests.error) throw new OfficeCalendarError(503, "Resilience calendar is temporarily unavailable");
    for (const row of plans.data ?? []) {
      const event = projected("CONTINUITY_TEST_DUE", String(row.id), `Continuity test due · ${row.title}`, dateIso(row.next_test_on), "DEADLINE", [row.plan_code,row.plan_type,row.status].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
    for (const row of tests.data ?? []) {
      const event = projected("RESILIENCE_TEST", String(row.id), `Resilience test · ${row.test_type}`, dateIso(row.scheduled_on), "REVIEW", [row.test_code,row.status].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
  }

  if (insurancePermission.allowed) {
    const { data, error } = await admin.from("office_insurance_policies").select("id,policy_code,insurance_type,provider_name,expires_on,status").eq("status", "ACTIVE").order("expires_on", { ascending: true }).limit(200);
    if (error) throw new OfficeCalendarError(503, "Insurance calendar is temporarily unavailable");
    for (const row of data ?? []) {
      const event = projected("INSURANCE_EXPIRY", String(row.id), `Insurance expiry · ${row.insurance_type}`, dateIso(row.expires_on, true), "DEADLINE", [row.policy_code,row.provider_name,row.status].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
  }

  if (custodyPermission.allowed) {
    const { data, error } = await admin.from("office_secure_custody_checkouts")
      .select("id,checkout_code,item_id,checked_out_to_user_id,due_back_at,status")
      .in("status",["OPEN","OVERDUE"]).not("due_back_at","is",null)
      .order("due_back_at",{ascending:true}).limit(500);
    if (error) throw new OfficeCalendarError(503, "Secure-custody calendar is temporarily unavailable");
    for (const row of data ?? []) {
      const event = projected("SECURE_CUSTODY_RETURN", String(row.id), `Secure item return · ${row.checkout_code}`, dateIso(row.due_back_at), "DEADLINE", [row.status,row.checked_out_to_user_id===identity.userId ? "assigned to you" : null].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
  }
  if (strategyPermission.allowed) {
    const cycles = await admin.from("office_strategy_cycles")
      .select("id,cycle_code,title,scope_type,scope_key,period_end,status")
      .in("status",["APPROVED","ACTIVE"]).order("period_end",{ascending:true}).limit(300);
    if (cycles.error) throw new OfficeCalendarError(503, "Strategy calendar is temporarily unavailable");
    const cycleIds = (cycles.data ?? []).map((row) => String(row.id));
    const objectives = cycleIds.length
      ? await admin.from("office_strategy_objectives").select("id,cycle_id").in("cycle_id",cycleIds).not("status","in",'("COMPLETED","CANCELLED")').limit(1200)
      : { data: [], error: null };
    if (objectives.error) throw new OfficeCalendarError(503, "Strategy calendar is temporarily unavailable");
    const objectiveIds = (objectives.data ?? []).map((row) => String(row.id));
    const keyResults = objectiveIds.length
      ? await admin.from("office_strategy_key_results")
          .select("id,key_result_code,objective_id,title,due_on,reported_status,owner_user_id")
          .in("objective_id",objectiveIds).not("due_on","is",null).not("reported_status","in",'("ACHIEVED","CANCELLED")')
          .order("due_on",{ascending:true}).limit(1800)
      : { data: [], error: null };
    if (keyResults.error) throw new OfficeCalendarError(503, "Strategy key-result calendar is temporarily unavailable");
    const cycleMap = new Map((cycles.data ?? []).map((row) => [String(row.id), row]));
    const objectiveMap = new Map((objectives.data ?? []).map((row) => [String(row.id), row]));
    for (const row of cycles.data ?? []) {
      const event = projected("STRATEGY_CYCLE_END", String(row.id), `Strategy period end · ${row.title}`, dateIso(row.period_end, true), "DEADLINE", [row.cycle_code,row.scope_type,row.scope_key,row.status].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
    for (const row of keyResults.data ?? []) {
      const objective = objectiveMap.get(String(row.objective_id));
      const cycle = objective ? cycleMap.get(String(objective.cycle_id)) : undefined;
      const event = projected("STRATEGY_KEY_RESULT", String(row.id), `Key result due · ${row.title}`, dateIso(row.due_on, true), "DEADLINE", [row.key_result_code,cycle?.cycle_code,row.reported_status,row.owner_user_id===identity.userId ? "owned by you" : null].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
  }
  if (qualityCompanyPermission.allowed || qualityDepartmentPermission.allowed || qualityOwnPermission.allowed) {
    const processScopeAllowed = qualityCompanyPermission.allowed || qualityDepartmentPermission.allowed;
    let processReviews: { data: Array<{id:string;process_code:string;title:string;department_code:string;next_review_on:string|null;status:string}>; error: {message?:string}|null } = { data: [], error: null };
    if (processScopeAllowed) {
      let processQuery = admin.from("office_quality_processes")
        .select("id,process_code,title,department_code,next_review_on,status")
        .eq("status","PUBLISHED").not("next_review_on","is",null)
        .order("next_review_on",{ascending:true}).limit(300);
      if (!qualityCompanyPermission.allowed && qualityDepartmentPermission.allowed && identity.department) processQuery = processQuery.eq("department_code",identity.department);
      processReviews = await processQuery as typeof processReviews;
    }

    let capas: { data: Array<{id:string;capa_code:string;nonconformance_id:string;owner_user_id:string;due_on:string|null;status:string}>; error: {message?:string}|null } = { data: [], error: null };
    if (qualityCompanyPermission.allowed) {
      capas = await admin.from("office_quality_capas")
        .select("id,capa_code,nonconformance_id,owner_user_id,due_on,status")
        .not("due_on","is",null).not("status","in",'("CLOSED","CANCELLED")')
        .order("due_on",{ascending:true}).limit(500) as typeof capas;
    } else if (qualityDepartmentPermission.allowed && identity.department) {
      const ncRows = await admin.from("office_quality_nonconformances").select("id").eq("department_code",identity.department).limit(1500);
      if (ncRows.error) throw new OfficeCalendarError(503, "Quality calendar is temporarily unavailable");
      const ncIds = (ncRows.data ?? []).map((row) => String(row.id));
      if (ncIds.length) capas = await admin.from("office_quality_capas")
        .select("id,capa_code,nonconformance_id,owner_user_id,due_on,status")
        .in("nonconformance_id",ncIds).not("due_on","is",null).not("status","in",'("CLOSED","CANCELLED")')
        .order("due_on",{ascending:true}).limit(500) as typeof capas;
    } else if (qualityOwnPermission.allowed) {
      capas = await admin.from("office_quality_capas")
        .select("id,capa_code,nonconformance_id,owner_user_id,due_on,status")
        .eq("owner_user_id",identity.userId).not("due_on","is",null).not("status","in",'("CLOSED","CANCELLED")')
        .order("due_on",{ascending:true}).limit(300) as typeof capas;
    }
    if (processReviews.error || capas.error) throw new OfficeCalendarError(503, "Quality calendar is temporarily unavailable");
    for (const row of processReviews.data ?? []) {
      const event = projected("QUALITY_PROCESS_REVIEW", String(row.id), `Process review · ${row.title}`, dateIso(row.next_review_on, true), "REVIEW", [row.process_code,row.department_code,row.status].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
    for (const row of capas.data ?? []) {
      const event = projected("QUALITY_CAPA_DUE", String(row.id), `CAPA due · ${row.capa_code}`, dateIso(row.due_on, true), "DEADLINE", [row.status,row.owner_user_id===identity.userId ? "assigned to you" : null].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
  }
  if (domainPermission.allowed) {
    const [domains, certificates] = await Promise.all([
      admin.from("office_corporate_domains")
        .select("id,domain_code,domain_name,expires_on,status,auto_renew")
        .not("expires_on", "is", null)
        .not("status", "in", '("EXPIRED","RETIRED")')
        .order("expires_on", { ascending: true }).limit(300),
      admin.from("office_tls_certificates")
        .select("id,certificate_code,hostname_pattern,issuer_name,expires_at,status,auto_managed")
        .not("status", "in", '("EXPIRED","REVOKED","REPLACED")')
        .order("expires_at", { ascending: true }).limit(500),
    ]);
    if (domains.error || certificates.error) throw new OfficeCalendarError(503, "Domain and certificate calendar is temporarily unavailable");
    for (const row of domains.data ?? []) {
      const event = projected("DOMAIN_EXPIRY", String(row.id), `Domain expiry · ${row.domain_name}`, dateIso(row.expires_on, true), "DEADLINE", [row.domain_code,row.status,row.auto_renew ? "auto-renew" : "manual renewal"].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
    for (const row of certificates.data ?? []) {
      const event = projected("TLS_EXPIRY", String(row.id), `TLS expiry · ${row.hostname_pattern}`, dateIso(row.expires_at), "DEADLINE", [row.certificate_code,row.issuer_name,row.status,row.auto_managed ? "auto-managed" : "manual lifecycle"].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
  }
  if (portfolioCompanyPermission.allowed || portfolioDepartmentPermission.allowed || portfolioMemberPermission.allowed) {
    let participantProjectIds: string[] | null = null;
    if (!portfolioCompanyPermission.allowed && !portfolioDepartmentPermission.allowed && portfolioMemberPermission.allowed) {
      const [ownedProjects, ownedWorkstreams, ownedMilestones, memberships] = await Promise.all([
        admin.from("office_portfolio_projects").select("id").eq("owner_user_id", identity.userId).limit(500),
        admin.from("office_portfolio_workstreams").select("project_id").eq("owner_user_id", identity.userId).neq("status", "CANCELLED").limit(1000),
        admin.from("office_portfolio_milestones").select("project_id").eq("owner_user_id", identity.userId).not("status", "in", '("DONE","CANCELLED")').limit(1500),
        admin.from("office_portfolio_members").select("project_id").eq("user_id", identity.userId).eq("active", true).limit(1500),
      ]);
      if (ownedProjects.error || ownedWorkstreams.error || ownedMilestones.error || memberships.error) {
        throw new OfficeCalendarError(503, "Assigned portfolio calendar is temporarily unavailable");
      }
      participantProjectIds = Array.from(new Set([
        ...(ownedProjects.data ?? []).map((row) => String(row.id)),
        ...(ownedWorkstreams.data ?? []).map((row) => String(row.project_id)),
        ...(ownedMilestones.data ?? []).map((row) => String(row.project_id)),
        ...(memberships.data ?? []).map((row) => String(row.project_id)),
      ]));
    }
    let projectQuery = admin.from("office_portfolio_projects")
      .select("id,project_code,title,department_code,target_end_on,status,reported_health")
      .not("target_end_on", "is", null)
      .not("status", "in", '("REJECTED","COMPLETED","CANCELLED")')
      .order("target_end_on", { ascending: true }).limit(300);
    if (!portfolioCompanyPermission.allowed && portfolioDepartmentPermission.allowed && identity.department) {
      projectQuery = projectQuery.eq("department_code", identity.department);
    } else if (!portfolioCompanyPermission.allowed && !portfolioDepartmentPermission.allowed) {
      projectQuery = participantProjectIds?.length
        ? projectQuery.in("id", participantProjectIds)
        : projectQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
    }
    const projects = await projectQuery;
    if (projects.error) throw new OfficeCalendarError(503, "Portfolio calendar is temporarily unavailable");
    const projectIds = (projects.data ?? []).map((row) => String(row.id));
    const milestones = projectIds.length
      ? await admin.from("office_portfolio_milestones")
          .select("id,milestone_code,project_id,title,due_on,status,owner_user_id")
          .in("project_id", projectIds)
          .not("due_on", "is", null)
          .not("status", "in", '("DONE","CANCELLED")')
          .order("due_on", { ascending: true }).limit(600)
      : { data: [], error: null };
    if (milestones.error) throw new OfficeCalendarError(503, "Portfolio milestone calendar is temporarily unavailable");
    const projectMap = new Map((projects.data ?? []).map((row) => [String(row.id), row]));
    for (const row of projects.data ?? []) {
      const event = projected("PORTFOLIO_PROJECT", String(row.id), `Project target · ${row.title}`, dateIso(row.target_end_on, true), "DEADLINE", [row.project_code,row.department_code,row.status,row.reported_health].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
    for (const row of milestones.data ?? []) {
      const project = projectMap.get(String(row.project_id));
      const event = projected("PORTFOLIO_MILESTONE", String(row.id), `Milestone · ${row.title}`, dateIso(row.due_on, true), "DEADLINE", [row.milestone_code,project?.project_code,row.status].filter(Boolean).join(" · "));
      if (event) synthetic.push(event);
    }
  }

  const events = [...internal.map((event) => ({ ...event, projected: false })), ...synthetic]
    .sort((left, right) => String(left.starts_at).localeCompare(String(right.starts_at)));

  return {
    actor: { user_id: identity.userId, roles: identity.roles, department, team, privileged },
    generated_at: new Date().toISOString(),
    events,
    disclaimer: "Projected dates come from canonical company records. The calendar does not calculate statutory due dates, board quorum or legal applicability.",
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
