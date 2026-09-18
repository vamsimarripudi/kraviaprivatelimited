import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  attachOfferDocument,
  createCandidate,
  createHiringRequisition,
  createOfferProposal,
  getOfficeRecruitmentOverview,
  markOfferAccepted,
  OfficeRecruitmentError,
  recordCandidateDocument,
  requestCandidateDocument,
  reviewCandidateDocument,
  scheduleInterview,
  submitHiringRequisition,
  submitInterviewFeedback,
  submitOfferProposal,
  syncHiringRequisition,
  syncOfferProposal,
  transitionCandidate,
} from "@/lib/office/recruitment-server";

const uuid = z.string().uuid();
const optionalText = (max: number) => z.string().trim().max(max).optional();
const currency = z.string().trim().length(3).transform((value) => value.toUpperCase());

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_REQUISITION"),
    position: z.string().trim().min(1).max(120),
    department: z.string().trim().min(1).max(120),
    manager_user_id: uuid,
    openings: z.number().int().min(1).max(1000),
    employment_type: z.enum(["EMPLOYEE","CONTRACTOR","INTERN","TRAINEE","PROFESSIONAL"]),
    work_mode: z.enum(["OFFICE","REMOTE","HYBRID","FIELD"]),
    location: optionalText(300),
    budget_min_minor: z.number().int().nonnegative().optional(),
    budget_max_minor: z.number().int().nonnegative().optional(),
    currency: currency.optional(),
    reason: z.string().trim().min(3).max(4000),
  }),
  z.object({ action: z.literal("SUBMIT_REQUISITION"), requisition_id: uuid }),
  z.object({ action: z.literal("SYNC_REQUISITION"), requisition_id: uuid }),
  z.object({
    action: z.literal("CREATE_CANDIDATE"),
    requisition_id: uuid,
    name: z.string().trim().min(2).max(220),
    email: z.string().trim().email().max(320),
    phone: optionalText(80),
    location: optionalText(300),
    source_channel: optionalText(80),
    source_reference: optionalText(1000),
  }),
  z.object({
    action: z.literal("TRANSITION_CANDIDATE"),
    candidate_id: uuid,
    status: z.enum(["APPLIED","SCREENING","INTERVIEW","SELECTED","OFFER_PENDING","OFFERED","ACCEPTED","DECLINED","REJECTED","WITHDRAWN","ONBOARDING","HIRED"]),
    note: optionalText(2000),
  }),
  z.object({
    action: z.literal("SCHEDULE_INTERVIEW"),
    candidate_id: uuid,
    stage: z.string().trim().min(1).max(80),
    title: z.string().trim().min(3).max(220),
    interviewer_user_id: uuid,
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }).optional(),
    location: optionalText(1000),
  }),
  z.object({
    action: z.literal("SUBMIT_FEEDBACK"),
    interview_id: uuid,
    outcome: z.enum(["STRONG_YES","YES","MIXED","NO","STRONG_NO"]),
    evidence: z.string().trim().min(3).max(6000),
    strengths: optionalText(4000),
    concerns: optionalText(4000),
  }),
  z.object({
    action: z.literal("REQUEST_DOCUMENT"),
    candidate_id: uuid,
    document_type: z.string().trim().min(1).max(100),
    label: z.string().trim().min(2).max(220),
    required: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("RECORD_DOCUMENT"),
    request_id: uuid,
    storage_reference: z.string().trim().min(3).max(1200),
    source_reference: optionalText(1200),
  }),
  z.object({
    action: z.literal("REVIEW_DOCUMENT"),
    request_id: uuid,
    decision: z.enum(["VERIFIED","REJECTED","WAIVED"]),
    note: optionalText(2000),
  }),
  z.object({
    action: z.literal("CREATE_OFFER"),
    candidate_id: uuid,
    manager_user_id: uuid,
    joining_date: z.string().date(),
    grade: optionalText(80),
    annual_ctc_minor: z.number().int().nonnegative(),
    monthly_gross_minor: z.number().int().nonnegative(),
    currency,
    components: z.array(z.unknown()).max(100).optional(),
    probation_months: z.number().int().min(0).max(36).optional(),
    variable_pay_note: optionalText(2000),
    special_condition_note: optionalText(4000),
    valid_until: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({ action: z.literal("SUBMIT_OFFER"), offer_id: uuid }),
  z.object({ action: z.literal("SYNC_OFFER"), offer_id: uuid }),
  z.object({ action: z.literal("ATTACH_OFFER_DOCUMENT"), offer_id: uuid, document_instance_id: uuid }),
  z.object({ action: z.literal("MARK_OFFER_ACCEPTED"), offer_id: uuid, evidence_reference: z.string().trim().min(3).max(1200) }),
]);

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof OfficeRecruitmentError ? error.status : 500;
  const detail = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    return NextResponse.json(await getOfficeRecruitmentOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to load recruitment workspace");
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin recruitment mutation is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid recruitment request" }, { status: 400 });
  try {
    const input = parsed.data;
    let result: unknown;
    switch (input.action) {
      case "CREATE_REQUISITION":
        result = await createHiringRequisition({
          position: input.position, department: input.department, managerUserId: input.manager_user_id, openings: input.openings,
          employmentType: input.employment_type, workMode: input.work_mode, location: input.location,
          budgetMinMinor: input.budget_min_minor, budgetMaxMinor: input.budget_max_minor, currency: input.currency, reason: input.reason,
        });
        break;
      case "SUBMIT_REQUISITION": result = await submitHiringRequisition(input.requisition_id); break;
      case "SYNC_REQUISITION": result = await syncHiringRequisition(input.requisition_id); break;
      case "CREATE_CANDIDATE":
        result = await createCandidate({ requisitionId: input.requisition_id, name: input.name, email: input.email, phone: input.phone, location: input.location, sourceChannel: input.source_channel, sourceReference: input.source_reference });
        break;
      case "TRANSITION_CANDIDATE": result = await transitionCandidate({ candidateId: input.candidate_id, status: input.status, note: input.note }); break;
      case "SCHEDULE_INTERVIEW": result = await scheduleInterview({ candidateId: input.candidate_id, stage: input.stage, title: input.title, interviewerUserId: input.interviewer_user_id, startsAt: input.starts_at, endsAt: input.ends_at, location: input.location }); break;
      case "SUBMIT_FEEDBACK": result = await submitInterviewFeedback({ interviewId: input.interview_id, outcome: input.outcome, evidence: input.evidence, strengths: input.strengths, concerns: input.concerns }); break;
      case "REQUEST_DOCUMENT": result = await requestCandidateDocument({ candidateId: input.candidate_id, type: input.document_type, label: input.label, required: input.required }); break;
      case "RECORD_DOCUMENT": result = await recordCandidateDocument({ requestId: input.request_id, storageReference: input.storage_reference, sourceReference: input.source_reference }); break;
      case "REVIEW_DOCUMENT": result = await reviewCandidateDocument({ requestId: input.request_id, decision: input.decision, note: input.note }); break;
      case "CREATE_OFFER":
        result = await createOfferProposal({
          candidateId: input.candidate_id, managerUserId: input.manager_user_id, joiningDate: input.joining_date, grade: input.grade,
          annualCtcMinor: input.annual_ctc_minor, monthlyGrossMinor: input.monthly_gross_minor, currency: input.currency,
          components: input.components, probationMonths: input.probation_months, variablePayNote: input.variable_pay_note,
          specialConditionNote: input.special_condition_note, validUntil: input.valid_until,
        });
        break;
      case "SUBMIT_OFFER": result = await submitOfferProposal(input.offer_id); break;
      case "SYNC_OFFER": result = await syncOfferProposal(input.offer_id); break;
      case "ATTACH_OFFER_DOCUMENT": result = await attachOfferDocument({ offerId: input.offer_id, documentInstanceId: input.document_instance_id }); break;
      case "MARK_OFFER_ACCEPTED": result = await markOfferAccepted({ offerId: input.offer_id, evidenceReference: input.evidence_reference }); break;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to update recruitment workflow");
  }
}
