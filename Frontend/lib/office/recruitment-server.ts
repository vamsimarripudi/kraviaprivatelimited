import "server-only";

import { readOfficeRuntimeResult } from "@/lib/office/runtime-read-server";
import { createHash, randomUUID } from "node:crypto";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";

export class OfficeRecruitmentError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeRecruitmentError";
  }
}

type Actor = Awaited<ReturnType<typeof requireOfficeActor>>;
type Authority = Actor & { decision: OfficePermissionDecision; department: string | null };

async function actor(): Promise<Actor> {
  try { return await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeRecruitmentError(error.status, error.message);
    throw error;
  }
}

async function permission(code: string): Promise<Authority> {
  const current = await actor();
  const resources: OfficeResourceScope[] = [
    ...(current.identity.department ? [{ type: "DEPARTMENT" as const, key: current.identity.department }] : []),
    { type: "COMPANY" },
  ];
  let decision: OfficePermissionDecision | undefined;
  for (const resource of resources) {
    const next = await resolveOfficePermission(current.admin, current.identity, code, resource);
    if (next.allowed) { decision = next; break; }
    decision = next;
  }
  if (!decision?.allowed) throw new OfficeRecruitmentError(403, decision?.reason ?? "Recruitment permission is required");
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
    if (error instanceof OfficeRecruitmentError && error.status === 403) return false;
    throw error;
  }
}

function scoped<T>(query: T, department: string | null) {
  if (!department) return query;
  return (query as T & { eq: (column: string, value: string) => T }).eq("department_code", department);
}

function assert(error: { message?: string } | null, message: string) {
  if (error) throw new OfficeRecruitmentError(503, message);
}

export async function getOfficeRecruitmentOverview() {
  const capabilities = {
    read_requisitions: await can("hiring.requisition.read"),
    manage_requisitions: await can("hiring.requisition.manage"),
    manage_candidates: await can("hiring.candidate.manage"),
    manage_interviews: await can("hiring.interview.manage"),
    prepare_offer: await can("hiring.offer.prepare"),
    review_offer: await can("hiring.offer.review"),
    manage_onboarding: await can("hiring.onboarding.manage"),
  };
  if (!Object.values(capabilities).some(Boolean)) throw new OfficeRecruitmentError(403, "Recruitment workspace is not assigned to your current authority");

  const read = capabilities.read_requisitions
    ? await permission("hiring.requisition.read")
    : capabilities.manage_requisitions
      ? await permission("hiring.requisition.manage")
      : capabilities.manage_candidates
        ? await permission("hiring.candidate.manage")
        : capabilities.manage_interviews
          ? await permission("hiring.interview.manage")
          : capabilities.prepare_offer
            ? await permission("hiring.offer.prepare")
            : capabilities.review_offer
              ? await permission("hiring.offer.review")
              : await permission("hiring.onboarding.manage");

  let requisitionQuery = read.admin.from("office_hiring_requisitions")
    .select("id,requisition_code,position_code,department_code,hiring_manager_user_id,openings,employment_type,work_mode,location_text,budget_min_minor,budget_max_minor,currency,business_reason,status,approval_request_id,approved_at,opened_at,closed_at,created_at,updated_at")
    .order("created_at", { ascending: false }).limit(300);
  requisitionQuery = scoped(requisitionQuery, read.department);

  const canSeeCandidates = capabilities.manage_candidates || capabilities.manage_interviews || capabilities.prepare_offer || capabilities.review_offer || capabilities.manage_onboarding || read.identity.roles.includes("OWNER");
  const [requisitions, identities, positions, departments] = await Promise.all([
    requisitionQuery,
    read.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status", "ACTIVE").order("display_name"),
    read.admin.from("office_position_catalog").select("code,label,department_code,is_manager,status").eq("status", "ACTIVE").order("department_code").order("label"),
    read.admin.from("office_department_catalog").select("code,label,status").eq("status", "ACTIVE").order("label"),
  ]);
  assert(requisitions.error || identities.error || positions.error || departments.error, "Recruitment reference data is temporarily unavailable");

  const requisitionIds = (requisitions.data ?? []).map((row) => String(row.id));
  const [candidates, offers, interviews, documents, events] = canSeeCandidates && requisitionIds.length ? await Promise.all([
    read.admin.from("office_candidates")
      .select("id,candidate_code,requisition_id,full_name,email,phone,location_text,source_channel,source_reference,resume_storage_reference,status,owner_user_id,created_by,created_at,updated_at")
      .in("requisition_id", requisitionIds).order("updated_at", { ascending: false }).limit(600),
    read.admin.from("office_offer_proposals")
      .select("id,offer_code,candidate_id,requisition_id,position_code,department_code,reporting_manager_user_id,employment_type,work_mode,work_location,joining_date,grade_code,annual_ctc_minor,monthly_gross_minor,currency,compensation_components,probation_months,variable_pay_note,special_condition_note,valid_until,status,approval_request_id,offer_document_instance_id,pre_onboarding_request_id,created_by,approved_by,approved_at,offered_at,accepted_at,declined_at,created_at,updated_at")
      .in("requisition_id", requisitionIds).order("updated_at", { ascending: false }).limit(600),
    read.admin.from("office_candidate_interviews")
      .select("id,candidate_id,stage_code,title,interviewer_user_id,scheduled_start,scheduled_end,location_or_link,status,created_by,created_at,updated_at")
      .order("scheduled_start", { ascending: false }).limit(800),
    read.admin.from("office_candidate_document_requests")
      .select("id,candidate_id,document_type,label,required,status,storage_reference,source_reference,sha256,mime_type,byte_size,original_filename,verified_by,verified_at,note,requested_by,requested_at,updated_at")
      .order("requested_at", { ascending: false }).limit(1000),
    read.admin.from("office_recruitment_events")
      .select("id,actor_user_id,requisition_id,candidate_id,offer_id,event_type,previous_status,new_status,note,metadata,created_at")
      .in("requisition_id", requisitionIds).order("created_at", { ascending: false }).limit(1400),
  ]) : [
    { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null },
  ];
  for (const result of [candidates, offers, interviews, documents, events]) assert(result.error, "Recruitment records are temporarily unavailable");

  const interviewIds = (interviews.data ?? []).map((row) => String(row.id));
  const feedback = canSeeCandidates && interviewIds.length
    ? await read.admin.from("office_candidate_interview_feedback")
        .select("id,interview_id,interviewer_user_id,outcome,evidence_note,strengths,concerns,submitted_at")
        .in("interview_id", interviewIds).order("submitted_at", { ascending: false }).limit(1000)
    : { data: [], error: null };
  assert(feedback.error, "Interview feedback is temporarily unavailable");

  const approvalIds = Array.from(new Set([
    ...(requisitions.data ?? []).map((row) => row.approval_request_id),
    ...(offers.data ?? []).map((row) => row.approval_request_id),
    ...(offers.data ?? []).map((row) => row.pre_onboarding_request_id),
  ].filter((value): value is string => typeof value === "string" && Boolean(value))));
  const approvals = approvalIds.length
    ? await read.admin.from("office_requests").select("id,request_type_code,title,status,current_step_order,due_at,submitted_at,completed_at,updated_at").in("id", approvalIds)
    : { data: [], error: null };
  assert(approvals.error, "Recruitment approval state is temporarily unavailable");

  return {
    generated_at: new Date().toISOString(),
    actor: { user_id: read.identity.userId, roles: read.identity.roles, department: read.identity.department ?? null },
    scope: { type: read.decision.scopeType ?? null, key: read.department },
    capabilities,
    identities: identities.data ?? [],
    positions: positions.data ?? [],
    departments: departments.data ?? [],
    requisitions: requisitions.data ?? [],
    candidates: candidates.data ?? [],
    interviews: interviews.data ?? [],
    feedback: feedback.data ?? [],
    offers: offers.data ?? [],
    documents: documents.data ?? [],
    approvals: approvals.data ?? [],
    events: events.data ?? [],
    disclaimer: "Recruitment selection, compensation, offer approval, document generation and access provisioning remain separate controls. An accepted offer never creates privileged Office or provider access automatically.",
  };
}

export async function createHiringRequisition(input: {
  position: string; department: string; managerUserId: string; openings: number; employmentType: string; workMode: string;
  location?: string; budgetMinMinor?: number; budgetMaxMinor?: number; currency?: string; reason: string;
}) {
  const current = await permission("hiring.requisition.manage");
  if (current.department && current.department !== input.department) throw new OfficeRecruitmentError(403, "Hiring requisition is outside your department scope");
  const { data, error } = await current.admin.rpc("office_hiring_requisition_create", {
    p_actor: current.identity.userId, p_position: input.position, p_department: input.department, p_manager: input.managerUserId,
    p_openings: input.openings, p_employment_type: input.employmentType, p_work_mode: input.workMode,
    p_location: input.location?.trim() || null, p_budget_min: input.budgetMinMinor ?? null, p_budget_max: input.budgetMaxMinor ?? null,
    p_currency: input.currency?.trim().toUpperCase() || null, p_reason: input.reason,
  });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to create hiring requisition");
  return { requisition_id: data };
}

export async function submitHiringRequisition(requisitionId: string) {
  const current = await permission("hiring.requisition.manage");
  const { data, error } = await current.admin.rpc("office_hiring_requisition_submit", { p_actor: current.identity.userId, p_requisition: requisitionId });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to submit hiring requisition");
  return { approval_request_id: data };
}

export async function syncHiringRequisition(requisitionId: string) {
  const current = await permission("hiring.requisition.read");
  const { data, error } = await current.admin.rpc("office_hiring_requisition_sync", { p_actor: current.identity.userId, p_requisition: requisitionId });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to synchronize requisition approval");
  return { status: data };
}

export async function createCandidate(input: { requisitionId: string; name: string; email: string; phone?: string; location?: string; sourceChannel?: string; sourceReference?: string }) {
  const current = await permission("hiring.candidate.manage");
  const { data, error } = await current.admin.rpc("office_candidate_create", {
    p_actor: current.identity.userId, p_requisition: input.requisitionId, p_name: input.name, p_email: input.email,
    p_phone: input.phone?.trim() || null, p_location: input.location?.trim() || null,
    p_source_channel: input.sourceChannel?.trim() || "DIRECT", p_source_reference: input.sourceReference?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to create candidate");
  return { candidate_id: data };
}

export async function transitionCandidate(input: { candidateId: string; status: string; note?: string }) {
  const current = await permission("hiring.candidate.manage");
  const { data, error } = await current.admin.rpc("office_candidate_transition", { p_actor: current.identity.userId, p_candidate: input.candidateId, p_status: input.status, p_note: input.note?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to update candidate");
  return { status: data };
}

export async function scheduleInterview(input: { candidateId: string; stage: string; title: string; interviewerUserId: string; startsAt: string; endsAt?: string; location?: string }) {
  const current = await permission("hiring.interview.manage");
  const { data, error } = await current.admin.rpc("office_interview_schedule", {
    p_actor: current.identity.userId, p_candidate: input.candidateId, p_stage: input.stage, p_title: input.title,
    p_interviewer: input.interviewerUserId, p_start: input.startsAt, p_end: input.endsAt ?? null, p_location: input.location?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to schedule interview");
  return { interview_id: data };
}

export async function submitInterviewFeedback(input: { interviewId: string; outcome: string; evidence: string; strengths?: string; concerns?: string }) {
  const current = await permission("hiring.interview.manage");
  const { data, error } = await current.admin.rpc("office_interview_feedback_submit", {
    p_actor: current.identity.userId, p_interview: input.interviewId, p_outcome: input.outcome,
    p_evidence: input.evidence, p_strengths: input.strengths?.trim() || null, p_concerns: input.concerns?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to submit interview feedback");
  return { feedback_id: data };
}

export async function requestCandidateDocument(input: { candidateId: string; type: string; label: string; required?: boolean }) {
  const current = await permission("hiring.candidate.manage");
  const { data, error } = await current.admin.rpc("office_candidate_document_request", {
    p_actor: current.identity.userId, p_candidate: input.candidateId, p_type: input.type, p_label: input.label, p_required: input.required ?? true,
  });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to request candidate document");
  return { document_request_id: data };
}

function candidateFileType(bytes: Buffer, claimedMime: string) {
  const claimed = claimedMime.toLowerCase().trim();
  const isPdf = bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(png);
  const isWebp = bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const detected = isPdf ? "application/pdf" : isJpeg ? "image/jpeg" : isPng ? "image/png" : isWebp ? "image/webp" : null;
  if (!detected || claimed !== detected) throw new OfficeRecruitmentError(400, "Candidate document content does not match an allowed file type");
  return { mime: detected, extension: detected === "application/pdf" ? "pdf" : detected === "image/jpeg" ? "jpg" : detected === "image/png" ? "png" : "webp" };
}

export async function uploadCandidateDocument(input: { requestId: string; fileName: string; claimedMime: string; bytes: Buffer; sourceReference?: string }) {
  const current = await permission("hiring.candidate.manage");
  if (!input.bytes.length || input.bytes.length > 26_214_400) throw new OfficeRecruitmentError(413, "Candidate document must be between 1 byte and 25 MiB");
  const fileType = candidateFileType(input.bytes, input.claimedMime);
  const digest = createHash("sha256").update(input.bytes).digest("hex");
  const storageReference = `${input.requestId}/${randomUUID()}.${fileType.extension}`;
  const upload = await current.admin.storage.from("office-candidate-documents").upload(storageReference, input.bytes, {
    contentType: fileType.mime,
    upsert: false,
    cacheControl: "0",
  });
  if (upload.error) throw new OfficeRecruitmentError(503, "Candidate document could not be written to the private recruitment vault");
  const { data, error } = await current.admin.rpc("office_candidate_document_received_v2", {
    p_actor: current.identity.userId,
    p_request: input.requestId,
    p_storage: storageReference,
    p_source: input.sourceReference?.trim() || null,
    p_sha: digest,
    p_mime: fileType.mime,
    p_size: input.bytes.length,
    p_filename: input.fileName.slice(0, 255),
  });
  if (error || typeof data !== "string") {
    await current.admin.storage.from("office-candidate-documents").remove([storageReference]);
    throw new OfficeRecruitmentError(400, error?.message ?? "Unable to record candidate document");
  }
  return { status: data, sha256: digest, byte_size: input.bytes.length, mime_type: fileType.mime };
}

export async function reviewCandidateDocument(input: { requestId: string; decision: "VERIFIED" | "REJECTED" | "WAIVED"; note?: string }) {
  const current = await permission("hiring.candidate.manage");
  const { data, error } = await current.admin.rpc("office_candidate_document_review", {
    p_actor: current.identity.userId, p_request: input.requestId, p_decision: input.decision, p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to review candidate document");
  return { status: data };
}

export async function createOfferProposal(input: {
  candidateId: string; managerUserId: string; joiningDate: string; grade?: string; annualCtcMinor: number; monthlyGrossMinor: number;
  currency: string; components?: unknown[]; probationMonths?: number; variablePayNote?: string; specialConditionNote?: string; validUntil?: string;
}) {
  const current = await permission("hiring.offer.prepare");
  const { data, error } = await current.admin.rpc("office_offer_create_draft", {
    p_actor: current.identity.userId, p_candidate: input.candidateId, p_manager: input.managerUserId, p_joining: input.joiningDate,
    p_grade: input.grade?.trim() || null, p_annual: input.annualCtcMinor, p_monthly: input.monthlyGrossMinor,
    p_currency: input.currency, p_components: input.components ?? [], p_probation: input.probationMonths ?? null,
    p_variable_note: input.variablePayNote?.trim() || null, p_special_note: input.specialConditionNote?.trim() || null,
    p_valid_until: input.validUntil ?? null,
  });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to create offer proposal");
  return { offer_id: data };
}

export async function submitOfferProposal(offerId: string) {
  const current = await permission("hiring.offer.prepare");
  const { data, error } = await current.admin.rpc("office_offer_submit", { p_actor: current.identity.userId, p_offer: offerId });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to submit offer proposal");
  return { approval_request_id: data };
}

export async function syncOfferProposal(offerId: string) {
  const current = await permission("hiring.offer.review");
  const { data, error } = await current.admin.rpc("office_offer_sync", { p_actor: current.identity.userId, p_offer: offerId });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to synchronize offer approval");
  return { status: data };
}

function moneyDisplay(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

export async function createOfferDocumentInstance(offerId: string) {
  const current = await permission("hiring.offer.prepare");
  const offerResult = await current.admin.from("office_offer_proposals")
    .select("id,offer_code,candidate_id,requisition_id,position_code,department_code,reporting_manager_user_id,employment_type,work_mode,work_location,joining_date,grade_code,annual_ctc_minor,monthly_gross_minor,currency,compensation_components,probation_months,variable_pay_note,special_condition_note,valid_until,status,offer_document_instance_id,approved_at")
    .eq("id", offerId).maybeSingle();
  if (offerResult.error || !offerResult.data) throw new OfficeRecruitmentError(404, "Offer proposal not found");
  const offer = offerResult.data;
  if (offer.status !== "APPROVED") throw new OfficeRecruitmentError(409, "Offer proposal must be independently approved before document generation");
  if (offer.offer_document_instance_id) return { document_instance_id: offer.offer_document_instance_id, already_exists: true };

  const [candidateResult, managerResult, companyResult] = await Promise.all([
    current.admin.from("office_candidates").select("id,candidate_code,full_name,email,phone,location_text").eq("id", offer.candidate_id).maybeSingle(),
    current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department").eq("user_id", offer.reporting_manager_user_id).maybeSingle(),
    readOfficeRuntimeResult<Record<string,unknown>>("company"),
  ]);
  if (candidateResult.error || !candidateResult.data) throw new OfficeRecruitmentError(409, "Candidate snapshot is unavailable for offer generation");
  if (managerResult.error || !managerResult.data) throw new OfficeRecruitmentError(409, "Reporting manager snapshot is unavailable for offer generation");
  if (companyResult.error || !companyResult.data) throw new OfficeRecruitmentError(409, "Controlled company master is unavailable for offer generation");
  const company = companyResult.data;
  const companyReady = Boolean(company.verified_at)
    && typeof company.cin === "string" && !company.cin.startsWith("CONTROLLED_")
    && typeof company.registered_office === "string" && !company.registered_office.toLowerCase().includes("not embedded");
  if (!companyReady) throw new OfficeRecruitmentError(409, "Controlled company master must be verified before an official offer letter can be generated");

  const candidate = candidateResult.data;
  const manager = managerResult.data;
  const snapshot = {
    company: {
      legal_name: company.legal_name,
      cin: company.cin,
      registered_office: company.registered_office,
      state_code: company.state_code,
      legal_entity_id: company.id,
      verified_at: company.verified_at,
    },
    candidate: {
      candidate_id: candidate.id,
      candidate_code: candidate.candidate_code,
      full_name: candidate.full_name,
      email: candidate.email,
      phone: candidate.phone,
      location: candidate.location_text,
    },
    employment: {
      position: offer.position_code,
      department: offer.department_code,
      reporting_manager: manager.display_name,
      reporting_manager_title: manager.job_title,
      reporting_manager_id: manager.user_id,
      employment_type: offer.employment_type,
      work_mode: offer.work_mode,
      work_location: offer.work_location,
      joining_date: offer.joining_date,
      grade: offer.grade_code,
      probation_months: offer.probation_months,
    },
    compensation: {
      annual_ctc_minor: offer.annual_ctc_minor,
      monthly_gross_minor: offer.monthly_gross_minor,
      annual_ctc: moneyDisplay(offer.annual_ctc_minor, offer.currency),
      monthly_gross: moneyDisplay(offer.monthly_gross_minor, offer.currency),
      currency: offer.currency,
      components: offer.compensation_components,
      variable_pay_note: offer.variable_pay_note,
    },
    offer: {
      offer_id: offer.id,
      offer_code: offer.offer_code,
      approved_at: offer.approved_at,
      valid_until: offer.valid_until,
      special_condition_note: offer.special_condition_note,
      prepared_at: new Date().toISOString(),
    },
  };

  const created = await current.admin.rpc("office_document_instance_create", {
    p_actor: current.identity.userId,
    p_template_code: "HR_OFFER",
    p_owner: current.identity.userId,
    p_subject_type: "CANDIDATE",
    p_subject_ref: candidate.id,
    p_business_type: "EMPLOYMENT_OFFER",
    p_business_key: offer.id,
    p_title: `Offer Letter · ${candidate.full_name} · ${offer.offer_code}`,
    p_input: snapshot,
  });
  if (created.error || typeof created.data !== "string") {
    throw new OfficeRecruitmentError(409, created.error?.message ?? "Published HR_OFFER template is required before generating offer letters");
  }
  const documentInstanceId = created.data;
  const submitted = await current.admin.rpc("office_document_instance_submit", { p_actor: current.identity.userId, p_instance: documentInstanceId });
  if (submitted.error) throw new OfficeRecruitmentError(400, submitted.error.message);
  const attached = await current.admin.rpc("office_offer_attach_document", { p_actor: current.identity.userId, p_offer: offer.id, p_document: documentInstanceId });
  if (attached.error || attached.data !== true) throw new OfficeRecruitmentError(400, attached.error?.message ?? "Unable to attach generated offer document");
  return {
    document_instance_id: documentInstanceId,
    approval_request_id: typeof submitted.data === "string" ? submitted.data : null,
    document_status: typeof submitted.data === "string" ? "PENDING_APPROVAL" : "APPROVED",
    already_exists: false,
  };
}

export async function attachOfferDocument(input: { offerId: string; documentInstanceId: string }) {
  const current = await permission("hiring.offer.prepare");
  const { data, error } = await current.admin.rpc("office_offer_attach_document", { p_actor: current.identity.userId, p_offer: input.offerId, p_document: input.documentInstanceId });
  if (error || data !== true) throw new OfficeRecruitmentError(400, error?.message ?? "Unable to attach offer document");
  return { attached: true };
}

export async function markOfferAccepted(input: { offerId: string; evidenceReference: string }) {
  const current = await permission("hiring.onboarding.manage");
  const { data, error } = await current.admin.rpc("office_offer_mark_accepted", { p_actor: current.identity.userId, p_offer: input.offerId, p_evidence_reference: input.evidenceReference });
  if (error || typeof data !== "string") throw new OfficeRecruitmentError(400, error?.message ?? "Unable to record offer acceptance");
  return { pre_onboarding_request_id: data };
}
