import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";

export class OfficePrivacyError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficePrivacyError";
  }
}

type Authority = Awaited<ReturnType<typeof requireOfficeActor>> & { decision: OfficePermissionDecision; ownerIds: string[] | null };

async function actor() {
  try { return await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficePrivacyError(error.status, error.message);
    throw error;
  }
}

async function permission(permissionCode: string): Promise<Authority> {
  const currentActor = await actor();
  const candidates: OfficeResourceScope[] = [
    ...(currentActor.identity.department ? [{ type: "DEPARTMENT" as const, key: currentActor.identity.department }] : []),
    { type: "OWN", ownerUserId: currentActor.identity.userId },
    { type: "COMPANY" },
  ];
  let decision: OfficePermissionDecision | undefined;
  for (const resource of candidates) {
    const current = await resolveOfficePermission(currentActor.admin, currentActor.identity, permissionCode, resource);
    if (current.allowed) { decision = current; break; }
    decision = current;
  }
  if (!decision?.allowed) throw new OfficePrivacyError(403, decision?.reason ?? "Privacy permission is required");
  let ownerIds: string[] | null = null;
  if (decision.source !== "OWNER" && decision.scopeType === "OWN") ownerIds = [currentActor.identity.userId];
  else if (decision.source !== "OWNER" && decision.scopeType === "DEPARTMENT") {
    const department = decision.scopeKey || currentActor.identity.department;
    if (!department) ownerIds = [currentActor.identity.userId];
    else {
      const { data, error } = await currentActor.admin.from("office_identity_users").select("user_id").eq("status", "ACTIVE").eq("primary_department", department);
      if (error) throw new OfficePrivacyError(503, "Unable to resolve privacy department scope");
      ownerIds = (data ?? []).map((row) => String(row.user_id));
    }
  }
  return { ...currentActor, decision, ownerIds };
}

function applyOwnerScope<T>(query: T, ownerIds: string[] | null) {
  if (!ownerIds) return query;
  return (query as T & { in: (column: string, values: string[]) => T }).in("owner_user_id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);
}
function ownerAllowed(ownerIds: string[] | null, ownerUserId: string) { return !ownerIds || ownerIds.includes(ownerUserId); }

async function writableCase(id: string) {
  const write = await permission("privacy.case.manage");
  const { data, error } = await write.admin.from("office_privacy_cases").select("id,case_code,title,status,owner_user_id").eq("id", id).maybeSingle();
  if (error || !data) throw new OfficePrivacyError(404, "Privacy case not found");
  if (!ownerAllowed(write.ownerIds, String(data.owner_user_id))) throw new OfficePrivacyError(403, "Privacy case is outside your assigned scope");
  return { ...write, privacyCase: data };
}

export async function getOfficePrivacyOverview() {
  const read = await permission("privacy.case.read");
  let casesQuery = read.admin.from("office_privacy_cases").select("id,case_code,case_type,subject_type,subject_reference,jurisdiction,title,description,source_channel,status,owner_user_id,created_by,source_reference,deadline_at,outcome_note,completed_at,created_at,updated_at").order("updated_at", { ascending: false }).limit(300);
  casesQuery = applyOwnerScope(casesQuery, read.ownerIds);
  const { data: cases, error: casesError } = await casesQuery;
  if (casesError) throw new OfficePrivacyError(503, "Privacy cases are temporarily unavailable");
  const rows = cases ?? [];
  const ids = rows.map((row) => String(row.id));
  const [eventsResult, ownersResult] = await Promise.all([
    ids.length ? read.admin.from("office_privacy_case_events").select("id,case_id,actor_user_id,event_type,previous_status,new_status,note,created_at").in("case_id", ids).order("created_at", { ascending: false }).limit(800) : Promise.resolve({ data: [], error: null }),
    (() => {
      let query = read.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status", "ACTIVE").order("display_name");
      if (read.ownerIds) query = query.in("user_id", read.ownerIds.length ? read.ownerIds : [read.identity.userId]);
      return query;
    })(),
  ]);
  if (eventsResult.error || ownersResult.error) throw new OfficePrivacyError(503, "Privacy reference data is temporarily unavailable");

  let canManage = false;
  let canReadRetention = false;
  try { await permission("privacy.case.manage"); canManage = true; } catch (error) { if (!(error instanceof OfficePrivacyError && error.status === 403)) throw error; }
  try { await permission("privacy.retention.read"); canReadRetention = true; } catch (error) { if (!(error instanceof OfficePrivacyError && error.status === 403)) throw error; }

  let retentionRules: unknown[] = [];
  let legalHolds: unknown[] = [];
  if (canReadRetention) {
    const [rules, holds] = await Promise.all([
      read.admin.from("office_retention_rules").select("code,record_class,title,jurisdiction,retention_period_text,retention_basis,source_reference,status,reviewed_by,reviewed_at,effective_from,effective_to,updated_at").order("record_class"),
      read.admin.from("office_legal_holds").select("id,hold_code,title,scope_type,scope_key,reason,status,placed_by,placed_at,released_by,released_at,source_reference,updated_at").order("placed_at", { ascending: false }).limit(200),
    ]);
    if (rules.error || holds.error) throw new OfficePrivacyError(503, "Retention and legal-hold registers are temporarily unavailable");
    retentionRules = rules.data ?? [];
    legalHolds = holds.data ?? [];
  }

  const eventsByCase = new Map<string, unknown[]>();
  for (const event of eventsResult.data ?? []) {
    const key = String(event.case_id);
    const current = eventsByCase.get(key) ?? [];
    current.push(event); eventsByCase.set(key, current);
  }

  return {
    generated_at: new Date().toISOString(),
    actor: { user_id: read.identity.userId, roles: read.identity.roles, department: read.identity.department ?? null },
    scope: { source: read.decision.source ?? null, type: read.decision.scopeType ?? null, key: read.decision.scopeKey ?? null },
    can_manage: canManage,
    can_read_retention: canReadRetention,
    owners: ownersResult.data ?? [],
    cases: rows.map((row) => ({ ...row, events: eventsByCase.get(String(row.id)) ?? [] })),
    retention_rules: retentionRules,
    legal_holds: legalHolds,
    disclaimer: "This workspace records privacy operations and evidence. Status labels are operational workflow states, not legal conclusions about statutory compliance or response deadlines.",
  };
}

export async function createOfficePrivacyCase(input: {
  ownerUserId: string;
  caseType: "ACCESS" | "CORRECTION" | "ERASURE" | "CONSENT_WITHDRAWAL" | "GRIEVANCE" | "OTHER";
  subjectType: "CUSTOMER" | "EMPLOYEE" | "PROSPECT" | "VENDOR" | "OTHER";
  subjectReference: string;
  jurisdiction?: string;
  title: string;
  description: string;
  sourceChannel?: string;
  sourceReference?: string;
  deadlineAt?: string;
}) {
  const write = await permission("privacy.case.manage");
  if (!ownerAllowed(write.ownerIds, input.ownerUserId)) throw new OfficePrivacyError(403, "Privacy owner is outside your assigned scope");
  const { data, error } = await write.admin.rpc("office_privacy_create_case", {
    p_actor: write.identity.userId,
    p_owner: input.ownerUserId,
    p_case_type: input.caseType,
    p_subject_type: input.subjectType,
    p_subject_reference: input.subjectReference,
    p_jurisdiction: input.jurisdiction?.trim() || "IN",
    p_title: input.title,
    p_description: input.description,
    p_source_channel: input.sourceChannel?.trim() || "INTERNAL",
    p_source_reference: input.sourceReference?.trim() || null,
    p_deadline_at: input.deadlineAt ?? null,
  });
  if (error || typeof data !== "string") throw new OfficePrivacyError(400, error?.message ?? "Unable to create privacy case");
  return { case_id: data };
}

export async function transitionOfficePrivacyCase(input: { caseId: string; status: "OPEN" | "VERIFY_IDENTITY" | "IN_REVIEW" | "ACTION_REQUIRED" | "COMPLETED" | "REJECTED"; note?: string }) {
  const write = await writableCase(input.caseId);
  const { data, error } = await write.admin.rpc("office_privacy_transition_case", {
    p_actor: write.identity.userId,
    p_case: input.caseId,
    p_status: input.status,
    p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficePrivacyError(400, error?.message ?? "Unable to transition privacy case");
  return { status: data };
}
