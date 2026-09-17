import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  approveComplianceRule,
  createComplianceInstance,
  createComplianceRule,
  evaluateComplianceRule,
  getOfficeApplicabilityOverview,
  OfficeApplicabilityError,
  reviewComplianceAssessment,
  transitionComplianceInstance,
  upsertApplicabilityFact,
} from "@/lib/office/applicability-server";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const jsonRecord = z.record(z.string(), z.unknown());
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("UPSERT_FACT"), code: z.string().trim().min(2).max(120), label: z.string().trim().min(2).max(180), fact_type: z.enum(["BOOLEAN","NUMBER","TEXT","DATE","JSON"]), value: z.unknown(), source_reference: z.string().trim().min(3).max(1000), effective_from: z.string().date().optional(), effective_to: z.string().date().optional() }),
  z.object({ action: z.literal("CREATE_RULE"), rule_code: z.string().trim().min(2).max(120), pack_code: z.string().trim().min(2).max(120), jurisdiction: z.string().trim().min(2).max(40), title: z.string().trim().min(3).max(240), authority: z.string().trim().min(2).max(240), source_reference: z.string().trim().min(3).max(1000), section_reference: optionalText(240), effective_from: z.string().date(), effective_to: z.string().date().optional(), condition: jsonRecord, frequency: z.enum(["EVENT","ONCE","MONTHLY","QUARTERLY","HALF_YEARLY","ANNUAL","CUSTOM"]), due_formula_text: z.string().trim().min(3).max(2000), owner_department: optionalText(120), reviewer_profile: optionalText(120), approver_role: optionalText(120), evidence_requirements: z.array(z.unknown()).max(100), retention_rule_text: optionalText(2000), escalation: jsonRecord }),
  z.object({ action: z.literal("APPROVE_RULE"), rule_code: z.string().trim().min(2).max(120), note: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("EVALUATE_RULE"), rule_code: z.string().trim().min(2).max(120) }),
  z.object({ action: z.literal("REVIEW_ASSESSMENT"), assessment_id: z.string().uuid(), result: z.enum(["APPLICABLE","NOT_APPLICABLE","UNKNOWN"]), note: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("CREATE_INSTANCE"), assessment_id: z.string().uuid(), period_key: z.string().trim().min(1).max(120), title: z.string().trim().min(3).max(240), due_at: z.string().datetime({ offset: true }).optional(), due_basis: z.string().trim().min(3).max(2000), owner_user_id: z.string().uuid(), reviewer_user_id: z.string().uuid().optional() }),
  z.object({ action: z.literal("TRANSITION_INSTANCE"), instance_id: z.string().uuid(), status: z.enum(["OPEN","PREPARED","REVIEWED","APPROVED","FILED","EVIDENCE_COMPLETE","NOT_APPLICABLE","CLOSED"]), filing_reference: optionalText(1000), evidence_reference: optionalText(1000), note: optionalText(4000) }),
]);

export async function GET() {
  try { return NextResponse.json(await getOfficeApplicabilityOverview(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    const status = error instanceof OfficeApplicabilityError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load applicability engine";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin compliance mutation is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid applicability request" }, { status: 400 });
  const input = parsed.data;
  try {
    let result: Record<string, unknown>;
    switch (input.action) {
      case "UPSERT_FACT": result = await upsertApplicabilityFact({ code: input.code, label: input.label, type: input.fact_type, value: input.value, sourceReference: input.source_reference, effectiveFrom: input.effective_from, effectiveTo: input.effective_to }); break;
      case "CREATE_RULE": result = await createComplianceRule({ ruleCode: input.rule_code, packCode: input.pack_code, jurisdiction: input.jurisdiction, title: input.title, authority: input.authority, sourceReference: input.source_reference, sectionReference: input.section_reference, effectiveFrom: input.effective_from, effectiveTo: input.effective_to, condition: input.condition, frequency: input.frequency, dueFormulaText: input.due_formula_text, ownerDepartment: input.owner_department, reviewerProfile: input.reviewer_profile, approverRole: input.approver_role, evidenceRequirements: input.evidence_requirements, retentionRuleText: input.retention_rule_text, escalation: input.escalation }); break;
      case "APPROVE_RULE": result = await approveComplianceRule(input.rule_code, input.note); break;
      case "EVALUATE_RULE": result = await evaluateComplianceRule(input.rule_code); break;
      case "REVIEW_ASSESSMENT": result = await reviewComplianceAssessment({ assessmentId: input.assessment_id, result: input.result, note: input.note }); break;
      case "CREATE_INSTANCE": result = await createComplianceInstance({ assessmentId: input.assessment_id, periodKey: input.period_key, title: input.title, dueAt: input.due_at, dueBasis: input.due_basis, ownerUserId: input.owner_user_id, reviewerUserId: input.reviewer_user_id }); break;
      case "TRANSITION_INSTANCE": result = await transitionComplianceInstance({ instanceId: input.instance_id, status: input.status, filingReference: input.filing_reference, evidenceReference: input.evidence_reference, note: input.note }); break;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeApplicabilityError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to update applicability engine";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
