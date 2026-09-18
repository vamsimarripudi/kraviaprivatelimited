import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeControlRegisterError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeControlRegisterError";
  }
}

type Actor = Awaited<ReturnType<typeof requireOfficeActor>>;
type Authority = Actor & { decision: OfficePermissionDecision; department: string | null };

async function actor(): Promise<Actor> {
  try { return await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeControlRegisterError(error.status, error.message);
    throw error;
  }
}

async function permission(code: string): Promise<Authority> {
  const current = await actor();
  const deviceId = await currentOfficeTrustedDeviceId(current.admin, current.identity.userId);
  const resources: OfficeResourceScope[] = [
    ...(current.identity.department ? [{ type: "DEPARTMENT" as const, key: current.identity.department }] : []),
    { type: "COMPANY" },
  ];
  let decision: OfficePermissionDecision | undefined;
  for (const resource of resources) {
    const next = await resolveOfficePermission(current.admin, current.identity, code, resource, deviceId);
    if (next.allowed) { decision = next; break; }
    decision = next;
  }
  if (!decision?.allowed) throw new OfficeControlRegisterError(403, decision?.reason ?? "Company-control permission is required");
  return {
    ...current,
    decision,
    department: decision.source === "OWNER" || decision.scopeType === "COMPANY"
      ? null
      : decision.scopeKey || current.identity.department || null,
  };
}

async function can(code: string) {
  try { await permission(code); return true; }
  catch (error) {
    if (error instanceof OfficeControlRegisterError && error.status === 403) return false;
    throw error;
  }
}

function scopeDepartment<T>(query: T, department: string | null) {
  if (!department) return query;
  return (query as T & { eq: (column: string, value: string) => T }).eq("department_code", department);
}

function fail(error: { message?: string } | null, message: string) {
  if (error) throw new OfficeControlRegisterError(503, message);
}

export async function getOfficeControlRegisterOverview() {
  const capabilities = {
    read_risk: await can("governance.risk.read"),
    manage_risk: await can("governance.risk.manage"),
    review_risk: await can("governance.risk.review"),
    read_decision: await can("governance.decision.read"),
    record_decision: await can("governance.decision.record"),
    read_change: await can("governance.change.read"),
    manage_change: await can("governance.change.manage"),
    review_change: await can("governance.change.review"),
  };
  if (!capabilities.read_risk && !capabilities.read_decision && !capabilities.read_change) {
    throw new OfficeControlRegisterError(403, "Risk, decision or controlled-change read authority is required");
  }

  const base = capabilities.read_risk
    ? await permission("governance.risk.read")
    : capabilities.read_change
      ? await permission("governance.change.read")
      : await permission("governance.decision.read");

  let riskQuery = base.admin.from("office_risks")
    .select("id,risk_code,title,category,description,owner_user_id,department_code,likelihood,impact,treatment,residual_likelihood,residual_impact,status,review_on,source_reference,acceptance_basis,closure_evidence_reference,reviewed_by,reviewed_at,created_by,created_at,updated_at")
    .order("updated_at", { ascending: false }).limit(500);
  let changeQuery = base.admin.from("office_controlled_changes")
    .select("id,change_code,change_kind,title,description,owner_user_id,department_code,risk_summary,implementation_plan,rollback_plan,approval_reference,effective_at,status,verification_evidence_reference,reviewer_user_id,reviewed_at,created_by,created_at,updated_at")
    .order("updated_at", { ascending: false }).limit(500);
  if (capabilities.read_risk) riskQuery = scopeDepartment(riskQuery, base.department);
  if (capabilities.read_change) changeQuery = scopeDepartment(changeQuery, base.department);

  const [risks, changes, decisions, people] = await Promise.all([
    capabilities.read_risk ? riskQuery : Promise.resolve({ data: [], error: null }),
    capabilities.read_change ? changeQuery : Promise.resolve({ data: [], error: null }),
    capabilities.read_decision
      ? base.admin.from("office_decisions")
          .select("id,decision_code,title,category,context,decision_text,decision_maker_user_id,decision_at,authority_basis,approval_reference,effective_from,review_on,status,supersedes_decision_id,superseded_by_decision_id,change_reason,source_reference,recorded_by,recorded_at,updated_at")
          .order("decision_at", { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
    base.admin.from("office_identity_users")
      .select("user_id,display_name,job_title,primary_department,status")
      .eq("status", "ACTIVE").order("display_name"),
  ]);
  for (const result of [risks, changes, decisions, people]) fail(result.error, "Company-control records are temporarily unavailable");

  const riskIds = (risks.data ?? []).map((row) => String(row.id));
  const actionResult = riskIds.length
    ? await base.admin.from("office_risk_actions")
        .select("id,action_code,risk_id,title,owner_user_id,due_on,status,evidence_reference,note,completed_at,created_by,created_at,updated_at")
        .in("risk_id", riskIds).order("due_on", { ascending: true }).limit(1500)
    : { data: [], error: null };
  fail(actionResult.error, "Risk actions are temporarily unavailable");

  const changeIds = (changes.data ?? []).map((row) => String(row.id));
  const decisionIds = (decisions.data ?? []).map((row) => String(row.id));
  const eventClauses = [
    riskIds.length ? `risk_id.in.(${riskIds.join(",")})` : "",
    changeIds.length ? `change_id.in.(${changeIds.join(",")})` : "",
    decisionIds.length ? `decision_id.in.(${decisionIds.join(",")})` : "",
  ].filter(Boolean);
  const events = eventClauses.length
    ? await base.admin.from("office_control_events")
        .select("id,actor_user_id,risk_id,risk_action_id,decision_id,change_id,event_type,previous_status,new_status,note,metadata,created_at")
        .or(eventClauses.join(",")).order("created_at", { ascending: false }).limit(1800)
    : { data: [], error: null };
  fail(events.error, "Company-control timeline is temporarily unavailable");

  return {
    generated_at: new Date().toISOString(),
    actor: { user_id: base.identity.userId, roles: base.identity.roles, department: base.identity.department ?? null },
    scope: { type: base.decision.scopeType ?? null, key: base.department },
    capabilities,
    people: people.data ?? [],
    risks: risks.data ?? [],
    risk_actions: actionResult.data ?? [],
    decisions: decisions.data ?? [],
    changes: changes.data ?? [],
    events: events.data ?? [],
    disclaimer: "The register records accountable company risk, decisions and controlled changes. It does not replace specialized statutory, board, banking, payroll, security or production approval workflows.",
  };
}

export async function createRisk(input: {
  title: string; category: string; description: string; ownerUserId: string; department?: string;
  likelihood: number; impact: number; treatment: string; reviewOn?: string; sourceReference?: string;
}) {
  const current = await permission("governance.risk.manage");
  const department = input.department?.trim() || current.identity.department || null;
  if (current.department && department !== current.department) throw new OfficeControlRegisterError(403, "Risk department is outside your authority");
  const { data, error } = await current.admin.rpc("office_risk_create", {
    p_actor: current.identity.userId, p_title: input.title, p_category: input.category, p_description: input.description,
    p_owner: input.ownerUserId, p_department: department, p_likelihood: input.likelihood, p_impact: input.impact,
    p_treatment: input.treatment, p_review_on: input.reviewOn ?? null, p_source: input.sourceReference?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeControlRegisterError(400, error?.message ?? "Unable to create risk");
  return { risk_id: data };
}

export async function updateRisk(input: {
  riskId: string; likelihood: number; impact: number; treatment: string; residualLikelihood?: number; residualImpact?: number;
  status: string; reviewOn?: string; acceptanceBasis?: string; closureEvidence?: string; note?: string;
}) {
  const current = await permission(input.status === "ACCEPTED" || input.status === "CLOSED" ? "governance.risk.review" : "governance.risk.manage");
  const { data, error } = await current.admin.rpc("office_risk_update", {
    p_actor: current.identity.userId, p_risk: input.riskId, p_likelihood: input.likelihood, p_impact: input.impact,
    p_treatment: input.treatment, p_residual_likelihood: input.residualLikelihood ?? null, p_residual_impact: input.residualImpact ?? null,
    p_status: input.status, p_review_on: input.reviewOn ?? null, p_acceptance_basis: input.acceptanceBasis?.trim() || null,
    p_closure_evidence: input.closureEvidence?.trim() || null, p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeControlRegisterError(400, error?.message ?? "Unable to update risk");
  return { status: data };
}

export async function createRiskAction(input: { riskId: string; title: string; ownerUserId: string; dueOn?: string; note?: string }) {
  const current = await permission("governance.risk.manage");
  const { data, error } = await current.admin.rpc("office_risk_action_create", {
    p_actor: current.identity.userId, p_risk: input.riskId, p_title: input.title, p_owner: input.ownerUserId,
    p_due: input.dueOn ?? null, p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeControlRegisterError(400, error?.message ?? "Unable to create risk action");
  return { risk_action_id: data };
}

export async function transitionRiskAction(input: { actionId: string; status: string; evidenceReference?: string; note?: string }) {
  const current = await actor();
  const { data, error } = await current.admin.rpc("office_risk_action_transition", {
    p_actor: current.identity.userId, p_action: input.actionId, p_status: input.status,
    p_evidence: input.evidenceReference?.trim() || null, p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeControlRegisterError(400, error?.message ?? "Unable to update risk action");
  return { status: data };
}

export async function recordDecision(input: {
  title: string; category: string; context: string; decision: string; decisionMakerUserId: string; decisionAt: string;
  authorityBasis: string; approvalReference?: string; effectiveFrom?: string; reviewOn?: string; sourceReference?: string;
  supersedesDecisionId?: string; changeReason?: string;
}) {
  const current = await permission("governance.decision.record");
  const { data, error } = await current.admin.rpc("office_decision_record", {
    p_actor: current.identity.userId, p_title: input.title, p_category: input.category, p_context: input.context,
    p_decision: input.decision, p_decision_maker: input.decisionMakerUserId, p_decision_at: input.decisionAt,
    p_authority_basis: input.authorityBasis, p_approval_reference: input.approvalReference?.trim() || null,
    p_effective_from: input.effectiveFrom ?? null, p_review_on: input.reviewOn ?? null, p_source: input.sourceReference?.trim() || null,
    p_supersedes: input.supersedesDecisionId ?? null, p_change_reason: input.changeReason?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeControlRegisterError(400, error?.message ?? "Unable to record decision");
  return { decision_id: data };
}

export async function revokeDecision(input: { decisionId: string; reason: string }) {
  const current = await permission("governance.decision.record");
  const { data, error } = await current.admin.rpc("office_decision_revoke", {
    p_actor: current.identity.userId, p_decision: input.decisionId, p_reason: input.reason,
  });
  if (error || data !== true) throw new OfficeControlRegisterError(400, error?.message ?? "Unable to revoke decision");
  return { revoked: true };
}

export async function createControlledChange(input: {
  kind: string; title: string; description: string; ownerUserId: string; department?: string; riskSummary?: string;
  implementationPlan: string; rollbackPlan?: string; effectiveAt?: string;
}) {
  const current = await permission("governance.change.manage");
  const department = input.department?.trim() || current.identity.department || null;
  if (current.department && department !== current.department) throw new OfficeControlRegisterError(403, "Change department is outside your authority");
  const { data, error } = await current.admin.rpc("office_change_create", {
    p_actor: current.identity.userId, p_kind: input.kind, p_title: input.title, p_description: input.description,
    p_owner: input.ownerUserId, p_department: department, p_risk_summary: input.riskSummary?.trim() || null,
    p_implementation: input.implementationPlan, p_rollback: input.rollbackPlan?.trim() || null, p_effective_at: input.effectiveAt ?? null,
  });
  if (error || typeof data !== "string") throw new OfficeControlRegisterError(400, error?.message ?? "Unable to create controlled change");
  return { change_id: data };
}

export async function transitionControlledChange(input: {
  changeId: string; status: string; approvalReference?: string; verificationEvidence?: string; note?: string;
}) {
  const review = ["APPROVED","REJECTED","VERIFIED","CLOSED"].includes(input.status);
  const current = await permission(review ? "governance.change.review" : "governance.change.manage");
  const { data, error } = await current.admin.rpc("office_change_transition", {
    p_actor: current.identity.userId, p_change: input.changeId, p_status: input.status,
    p_approval_reference: input.approvalReference?.trim() || null, p_verification_evidence: input.verificationEvidence?.trim() || null,
    p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeControlRegisterError(400, error?.message ?? "Unable to transition controlled change");
  return { status: data };
}
