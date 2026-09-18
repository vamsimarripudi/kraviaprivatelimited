import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  createControlledChange,
  createRisk,
  createRiskAction,
  getOfficeControlRegisterOverview,
  OfficeControlRegisterError,
  recordDecision,
  revokeDecision,
  transitionControlledChange,
  transitionRiskAction,
  updateRisk,
} from "@/lib/office/control-register-server";

const uuid = z.string().uuid();
const optionalText = (max: number) => z.string().trim().max(max).optional();
const oneToFive = z.number().int().min(1).max(5);

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_RISK"),
    title: z.string().trim().min(3).max(220),
    category: z.enum(["FINANCIAL","OPERATIONAL","SECURITY","LEGAL","COMPLIANCE","PEOPLE","VENDOR","PRODUCT","CUSTOMER","INFRASTRUCTURE","PRIVACY","STRATEGIC","OTHER"]),
    description: z.string().trim().min(3).max(8000),
    owner_user_id: uuid,
    department: optionalText(120),
    likelihood: oneToFive,
    impact: oneToFive,
    treatment: z.enum(["AVOID","MITIGATE","TRANSFER","ACCEPT"]),
    review_on: z.string().date().optional(),
    source_reference: optionalText(1200),
  }),
  z.object({
    action: z.literal("UPDATE_RISK"),
    risk_id: uuid,
    likelihood: oneToFive,
    impact: oneToFive,
    treatment: z.enum(["AVOID","MITIGATE","TRANSFER","ACCEPT"]),
    residual_likelihood: oneToFive.optional(),
    residual_impact: oneToFive.optional(),
    status: z.enum(["IDENTIFIED","ASSESSING","MITIGATING","MONITORING","ACCEPTED","CLOSED"]),
    review_on: z.string().date().optional(),
    acceptance_basis: optionalText(4000),
    closure_evidence: optionalText(1200),
    note: optionalText(2000),
  }),
  z.object({
    action: z.literal("CREATE_RISK_ACTION"),
    risk_id: uuid,
    title: z.string().trim().min(3).max(220),
    owner_user_id: uuid,
    due_on: z.string().date().optional(),
    note: optionalText(2000),
  }),
  z.object({
    action: z.literal("TRANSITION_RISK_ACTION"),
    risk_action_id: uuid,
    status: z.enum(["OPEN","IN_PROGRESS","BLOCKED","DONE","CANCELLED"]),
    evidence_reference: optionalText(1200),
    note: optionalText(2000),
  }),
  z.object({
    action: z.literal("RECORD_DECISION"),
    title: z.string().trim().min(3).max(240),
    category: z.enum(["STRATEGY","PRODUCT","FINANCE","PEOPLE","LEGAL","SECURITY","OPERATIONS","CUSTOMER","VENDOR","GOVERNANCE","OTHER"]),
    context: z.string().trim().min(3).max(10000),
    decision: z.string().trim().min(3).max(10000),
    decision_maker_user_id: uuid,
    decision_at: z.string().datetime({ offset: true }),
    authority_basis: z.string().trim().min(3).max(3000),
    approval_reference: optionalText(1200),
    effective_from: z.string().date().optional(),
    review_on: z.string().date().optional(),
    source_reference: optionalText(1200),
    supersedes_decision_id: uuid.optional(),
    change_reason: optionalText(3000),
  }),
  z.object({
    action: z.literal("REVOKE_DECISION"),
    decision_id: uuid,
    reason: z.string().trim().min(3).max(3000),
  }),
  z.object({
    action: z.literal("CREATE_CHANGE"),
    kind: z.enum(["ORGANISATION","POLICY","COMPENSATION","FINANCE","INFRASTRUCTURE","LEGAL","PROCESS","SECURITY","DATA","PRODUCT","CUSTOMER","VENDOR","OTHER"]),
    title: z.string().trim().min(3).max(240),
    description: z.string().trim().min(3).max(10000),
    owner_user_id: uuid,
    department: optionalText(120),
    risk_summary: optionalText(5000),
    implementation_plan: z.string().trim().min(3).max(10000),
    rollback_plan: optionalText(10000),
    effective_at: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({
    action: z.literal("TRANSITION_CHANGE"),
    change_id: uuid,
    status: z.enum(["APPROVED","REJECTED","IN_PROGRESS","VERIFIED","ROLLED_BACK","CLOSED"]),
    approval_reference: optionalText(1200),
    verification_evidence: optionalText(1200),
    note: optionalText(3000),
  }),
]);

function failure(error: unknown, fallback: string) {
  const status = error instanceof OfficeControlRegisterError ? error.status : 500;
  const detail = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    return NextResponse.json(await getOfficeControlRegisterOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, "Unable to load company control register");
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin company-control mutation is not allowed" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid company-control request" }, { status: 400 });
  try {
    const input = parsed.data;
    let result: unknown;
    switch (input.action) {
      case "CREATE_RISK":
        result = await createRisk({
          title: input.title, category: input.category, description: input.description, ownerUserId: input.owner_user_id,
          department: input.department, likelihood: input.likelihood, impact: input.impact, treatment: input.treatment,
          reviewOn: input.review_on, sourceReference: input.source_reference,
        });
        break;
      case "UPDATE_RISK":
        result = await updateRisk({
          riskId: input.risk_id, likelihood: input.likelihood, impact: input.impact, treatment: input.treatment,
          residualLikelihood: input.residual_likelihood, residualImpact: input.residual_impact, status: input.status,
          reviewOn: input.review_on, acceptanceBasis: input.acceptance_basis, closureEvidence: input.closure_evidence, note: input.note,
        });
        break;
      case "CREATE_RISK_ACTION":
        result = await createRiskAction({ riskId: input.risk_id, title: input.title, ownerUserId: input.owner_user_id, dueOn: input.due_on, note: input.note });
        break;
      case "TRANSITION_RISK_ACTION":
        result = await transitionRiskAction({ actionId: input.risk_action_id, status: input.status, evidenceReference: input.evidence_reference, note: input.note });
        break;
      case "RECORD_DECISION":
        result = await recordDecision({
          title: input.title, category: input.category, context: input.context, decision: input.decision,
          decisionMakerUserId: input.decision_maker_user_id, decisionAt: input.decision_at, authorityBasis: input.authority_basis,
          approvalReference: input.approval_reference, effectiveFrom: input.effective_from, reviewOn: input.review_on,
          sourceReference: input.source_reference, supersedesDecisionId: input.supersedes_decision_id, changeReason: input.change_reason,
        });
        break;
      case "REVOKE_DECISION":
        result = await revokeDecision({ decisionId: input.decision_id, reason: input.reason });
        break;
      case "CREATE_CHANGE":
        result = await createControlledChange({
          kind: input.kind, title: input.title, description: input.description, ownerUserId: input.owner_user_id,
          department: input.department, riskSummary: input.risk_summary, implementationPlan: input.implementation_plan,
          rollbackPlan: input.rollback_plan, effectiveAt: input.effective_at,
        });
        break;
      case "TRANSITION_CHANGE":
        result = await transitionControlledChange({
          changeId: input.change_id, status: input.status, approvalReference: input.approval_reference,
          verificationEvidence: input.verification_evidence, note: input.note,
        });
        break;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, "Unable to update company control register");
  }
}
