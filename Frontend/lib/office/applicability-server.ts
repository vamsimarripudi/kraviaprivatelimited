import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
} from "@/lib/office/permission-engine";

export class OfficeApplicabilityError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeApplicabilityError";
  }
}

async function actor() {
  try { return await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeApplicabilityError(error.status, error.message);
    throw error;
  }
}

async function permission(code: string) {
  const current = await actor();
  const decision = await resolveOfficePermission(current.admin, current.identity, code, { type: "COMPANY" });
  if (!decision.allowed) throw new OfficeApplicabilityError(403, decision.reason);
  return { ...current, decision };
}

async function can(code: string) {
  try { await permission(code); return true; }
  catch (error) {
    if (error instanceof OfficeApplicabilityError && error.status === 403) return false;
    throw error;
  }
}

export async function getOfficeApplicabilityOverview() {
  const read = await permission("compliance.rules.read");
  const [packs, facts, rules, assessments, instances, events, people] = await Promise.all([
    read.admin.from("office_compliance_packs").select("code,label,jurisdiction,description,status,updated_at").order("label"),
    read.admin.from("office_applicability_facts").select("fact_code,label,fact_type,value_json,source_reference,effective_from,effective_to,status,recorded_by,reviewed_by,reviewed_at,created_at,updated_at").order("fact_code"),
    read.admin.from("office_compliance_rules").select("rule_code,pack_code,jurisdiction,title,authority,source_reference,section_reference,effective_from,effective_to,condition_json,frequency,due_formula_text,owner_department,reviewer_profile,approver_role,evidence_requirements,retention_rule_text,escalation_json,status,approved_by,approved_at,last_legal_review_at,review_note,created_by,created_at,updated_at").order("updated_at", { ascending: false }).limit(500),
    read.admin.from("office_compliance_assessments").select("id,rule_code,candidate_result,candidate_reason,missing_facts,facts_snapshot,evaluated_by,evaluated_at,review_status,reviewed_result,reviewed_by,reviewed_at,review_note,created_at").order("evaluated_at", { ascending: false }).limit(500),
    read.admin.from("office_compliance_instances").select("id,assessment_id,rule_code,period_key,title,due_at,due_basis,source_reference,owner_user_id,reviewer_user_id,status,filing_reference,evidence_reference,completion_note,completed_at,created_by,created_at,updated_at").order("created_at", { ascending: false }).limit(500),
    read.admin.from("office_compliance_engine_events").select("id,actor_user_id,rule_code,assessment_id,instance_id,event_type,note,metadata,created_at").order("created_at", { ascending: false }).limit(500),
    read.admin.from("office_identity_users").select("user_id,status,display_name,job_title,primary_department").eq("status", "ACTIVE").order("display_name"),
  ]);
  if ([packs, facts, rules, assessments, instances, events, people].some((result) => result.error)) throw new OfficeApplicabilityError(503, "Applicability evidence sources are temporarily unavailable");

  const [manageRules, manageFacts, reviewApplicability, manageInstances] = await Promise.all([
    can("compliance.rules.manage"),
    can("compliance.facts.manage"),
    can("compliance.applicability.review"),
    can("compliance.instance.manage"),
  ]);

  return {
    generated_at: new Date().toISOString(),
    actor: { user_id: read.identity.userId, roles: read.identity.roles, department: read.identity.department ?? null },
    capabilities: {
      manage_rules: manageRules,
      manage_facts: manageFacts,
      review_applicability: reviewApplicability,
      manage_instances: manageInstances,
    },
    packs: packs.data ?? [],
    facts: facts.data ?? [],
    rules: rules.data ?? [],
    assessments: assessments.data ?? [],
    instances: instances.data ?? [],
    events: events.data ?? [],
    people: people.data ?? [],
    disclaimer: "The engine produces candidate applicability only from approved source-backed rules and recorded facts. A human/professional review is required before an obligation instance can be created; due dates are recorded with their source basis rather than calculated as legal advice.",
  };
}

function factValue(type: string, value: unknown) {
  const normalized = type.toUpperCase();
  if (normalized === "BOOLEAN") {
    if (typeof value !== "boolean") throw new OfficeApplicabilityError(400, "Boolean fact value is required");
    return value;
  }
  if (normalized === "NUMBER") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new OfficeApplicabilityError(400, "Numeric fact value is required");
    return value;
  }
  if (normalized === "TEXT" || normalized === "DATE") {
    if (typeof value !== "string" || value.trim().length < 1) throw new OfficeApplicabilityError(400, "Text/date fact value is required");
    return value.trim();
  }
  return value;
}

export async function upsertApplicabilityFact(input: { code: string; label: string; type: "BOOLEAN" | "NUMBER" | "TEXT" | "DATE" | "JSON"; value: unknown; sourceReference: string; effectiveFrom?: string; effectiveTo?: string }) {
  const write = await permission("compliance.facts.manage");
  const { data, error } = await write.admin.rpc("office_compliance_upsert_fact", {
    p_actor: write.identity.userId,
    p_code: input.code,
    p_label: input.label,
    p_type: input.type,
    p_value: factValue(input.type, input.value),
    p_source: input.sourceReference,
    p_effective_from: input.effectiveFrom ?? new Date().toISOString().slice(0, 10),
    p_effective_to: input.effectiveTo ?? null,
  });
  if (error || typeof data !== "string") throw new OfficeApplicabilityError(400, error?.message ?? "Unable to record applicability fact");
  return { fact_code: data };
}

export async function createComplianceRule(input: {
  ruleCode: string;
  packCode: string;
  jurisdiction: string;
  title: string;
  authority: string;
  sourceReference: string;
  sectionReference?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  condition: Record<string, unknown>;
  frequency: "EVENT" | "ONCE" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL" | "CUSTOM";
  dueFormulaText: string;
  ownerDepartment?: string;
  reviewerProfile?: string;
  approverRole?: string;
  evidenceRequirements: unknown[];
  retentionRuleText?: string;
  escalation: Record<string, unknown>;
}) {
  const write = await permission("compliance.rules.manage");
  const { data, error } = await write.admin.rpc("office_compliance_create_rule", {
    p_actor: write.identity.userId,
    p_rule_code: input.ruleCode,
    p_pack: input.packCode,
    p_jurisdiction: input.jurisdiction,
    p_title: input.title,
    p_authority: input.authority,
    p_source: input.sourceReference,
    p_section: input.sectionReference?.trim() || null,
    p_effective_from: input.effectiveFrom,
    p_effective_to: input.effectiveTo ?? null,
    p_condition: input.condition,
    p_frequency: input.frequency,
    p_due_formula: input.dueFormulaText,
    p_owner_department: input.ownerDepartment?.trim() || null,
    p_reviewer_profile: input.reviewerProfile?.trim() || null,
    p_approver_role: input.approverRole?.trim() || null,
    p_evidence: input.evidenceRequirements,
    p_retention: input.retentionRuleText?.trim() || null,
    p_escalation: input.escalation,
  });
  if (error || typeof data !== "string") throw new OfficeApplicabilityError(400, error?.message ?? "Unable to save compliance rule");
  return { rule_code: data };
}

export async function approveComplianceRule(ruleCode: string, note: string) {
  const review = await permission("compliance.applicability.review");
  const { data, error } = await review.admin.rpc("office_compliance_approve_rule", { p_actor: review.identity.userId, p_rule: ruleCode, p_note: note });
  if (error || data !== "APPROVED") throw new OfficeApplicabilityError(400, error?.message ?? "Unable to approve compliance rule");
  return { status: data };
}

export async function evaluateComplianceRule(ruleCode: string) {
  const read = await permission("compliance.rules.read");
  const { data, error } = await read.admin.rpc("office_compliance_evaluate_rule", { p_actor: read.identity.userId, p_rule: ruleCode });
  if (error || typeof data !== "string") throw new OfficeApplicabilityError(400, error?.message ?? "Unable to evaluate compliance rule");
  return { assessment_id: data };
}

export async function reviewComplianceAssessment(input: { assessmentId: string; result: "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN"; note: string }) {
  const review = await permission("compliance.applicability.review");
  const { data, error } = await review.admin.rpc("office_compliance_review_assessment", { p_actor: review.identity.userId, p_assessment: input.assessmentId, p_result: input.result, p_note: input.note });
  if (error || typeof data !== "string") throw new OfficeApplicabilityError(400, error?.message ?? "Unable to review applicability assessment");
  return { result: data };
}

export async function createComplianceInstance(input: { assessmentId: string; periodKey: string; title: string; dueAt?: string; dueBasis: string; ownerUserId: string; reviewerUserId?: string }) {
  const manage = await permission("compliance.instance.manage");
  const { data, error } = await manage.admin.rpc("office_compliance_create_instance", { p_actor: manage.identity.userId, p_assessment: input.assessmentId, p_period_key: input.periodKey, p_title: input.title, p_due_at: input.dueAt ?? null, p_due_basis: input.dueBasis, p_owner: input.ownerUserId, p_reviewer: input.reviewerUserId ?? null });
  if (error || typeof data !== "string") throw new OfficeApplicabilityError(400, error?.message ?? "Unable to create compliance obligation instance");
  return { instance_id: data };
}

export async function transitionComplianceInstance(input: { instanceId: string; status: "OPEN" | "PREPARED" | "REVIEWED" | "APPROVED" | "FILED" | "EVIDENCE_COMPLETE" | "NOT_APPLICABLE" | "CLOSED"; filingReference?: string; evidenceReference?: string; note?: string }) {
  const manage = await permission("compliance.instance.manage");
  const { data, error } = await manage.admin.rpc("office_compliance_transition_instance", { p_actor: manage.identity.userId, p_instance: input.instanceId, p_status: input.status, p_filing: input.filingReference?.trim() || null, p_evidence: input.evidenceReference?.trim() || null, p_note: input.note?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeApplicabilityError(400, error?.message ?? "Unable to transition compliance obligation");
  return { status: data };
}
