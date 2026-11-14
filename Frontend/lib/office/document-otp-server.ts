import "server-only";

import { createHash, createHmac, randomInt, randomUUID } from "node:crypto";
import { getOfficeSessionContext } from "@/lib/office/auth-server";
import { requireOfficeActor, OfficePermissionError } from "@/lib/office/permission-engine";
import {
  documentOtpMailReady, sendOfficeDocumentApprovalCode,
  DocumentOtpMailRejected, DocumentOtpMailUnavailable, DocumentOtpMailUnknown,
} from "@/lib/office/document-otp-email";

export class OfficeDocumentOtpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeDocumentOtpError";
  }
}

type Current = Awaited<ReturnType<typeof requireOfficeActor>>;
type Document = {
  id: string; document_code: string; title: string; owner_user_id: string;
  subject_type: string; subject_reference: string; status: string;
  approved_by: string | null; approved_at: string | null;
};
type Render = {
  id: string; document_instance_id: string; output_format: string;
  sha256: string; status: string; generated_at?: string | null;
};
export type OfficeDocumentApprovalStamp = {
  id: string; document_instance_id: string; render_id: string;
  signer_user_id: string; signer_name: string; employee_reference: string;
  signer_email_masked: string; render_sha256: string;
  latitude: number; longitude: number; accuracy_m: number;
  location_captured_at: string; location_source: string;
  approved_at: string; method: "FIRST_PARTY_EMAIL_OTP"; status: "APPROVED";
};
const stampFields = "id,document_instance_id,render_id,signer_user_id,signer_name,employee_reference,signer_email_masked,render_sha256,latitude,longitude,accuracy_m,location_captured_at,location_source,approved_at,method,status";

function safeError(error: unknown, fallback: string): OfficeDocumentOtpError {
  if (error instanceof OfficeDocumentOtpError) return error;
  if (error instanceof OfficePermissionError) return new OfficeDocumentOtpError(error.status, error.message);
  return new OfficeDocumentOtpError(503, fallback);
}

function secret() {
  const value = process.env.OFFICE_DOCUMENT_OTP_HMAC_SECRET?.trim() || "";
  if (value.length < 32)
    throw new OfficeDocumentOtpError(503, "Office document OTP signing secret is not configured");
  return value;
}

function digestCode(challengeId: string, code: string) {
  return createHmac("sha256", secret()).update("office-document-otp:" + challengeId + ":" + code).digest("hex");
}

function mask(email: string) {
  const at = email.indexOf("@");
  return email.slice(0, 1) + "***" + email.slice(at);
}

async function signerContext() {
  const current = await requireOfficeActor();
  const context = await getOfficeSessionContext();
  if (!context || !context.session.access_token ||
      context.identity.userId !== current.identity.userId ||
      context.identity.aal !== "aal2")
    throw new OfficeDocumentOtpError(401, "Fresh authenticated Office session required");

  const id = current.identity.userId;
  const { data, error } = await current.admin.from("office_auth_users")
    .select("email,status").eq("id", id).maybeSingle();
  if (error || !data || data.status !== "ACTIVE")
    throw new OfficeDocumentOtpError(403, "Active corporate email identity unavailable");
  const email = String(data.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email) ||
      !current.identity.email || email !== current.identity.email.trim().toLowerCase())
    throw new OfficeDocumentOtpError(409, "Office session email does not match the corporate identity record");
  return {
    current, email, userId: id,
    sessionHash: createHash("sha256").update(context.session.access_token).digest("hex"),
  };
}

function documentIsAssigned(doc: Document, actorId: string) {
  return doc.subject_type === "EMPLOYEE"
    ? doc.subject_reference === actorId
    : doc.owner_user_id === actorId;
}

async function checkedDocument(current: Current, instanceId: string, renderId: string) {
  const [a, b] = await Promise.all([
    current.admin.from("office_document_instances")
      .select("id,document_code,title,owner_user_id,subject_type,subject_reference,status,approved_by,approved_at")
      .eq("id", instanceId).maybeSingle(),
    current.admin.from("office_document_renders")
      .select("id,document_instance_id,output_format,sha256,status")
      .eq("id", renderId).maybeSingle(),
  ]);
  if (a.error || b.error) throw new OfficeDocumentOtpError(503, "Document state cannot be verified");
  const doc = a.data as Document | null;
  const render = b.data as Render | null;
  if (!doc || !render || !documentIsAssigned(doc, current.identity.userId) ||
      render.document_instance_id !== doc.id ||
      !["RENDERED", "SIGNING"].includes(doc.status) ||
      !doc.approved_at || !doc.approved_by ||
      render.output_format !== "PDF" || render.status !== "GENERATED" ||
      !/^[a-f0-9]{64}$/.test(render.sha256))
    throw new OfficeDocumentOtpError(403, "No approved PDF is assigned to this signer's current account");
  return { doc, render };
}

async function stampById(current: Current, id: string): Promise<OfficeDocumentApprovalStamp> {
  const { data, error } = await current.admin.from("office_document_otp_approvals")
    .select(stampFields).eq("id", id).maybeSingle();
  if (error || !data || (data.signer_user_id !== current.identity.userId &&
     !current.identity.roles.includes("OWNER")))
    throw new OfficeDocumentOtpError(503, "Verified approval receipt was not available");
  return data as OfficeDocumentApprovalStamp;
}

export async function getAssignedDocumentApprovals() {
  try {
    const { current, email, userId } = await signerContext();
    const [owned, subject, ref] = await Promise.all([
      current.admin.from("office_document_instances")
        .select("id,document_code,title,owner_user_id,subject_type,subject_reference,status,approved_by,approved_at")
        .eq("owner_user_id", userId).in("status", ["RENDERED", "SIGNING"]).limit(60),
      current.admin.from("office_document_instances")
        .select("id,document_code,title,owner_user_id,subject_type,subject_reference,status,approved_by,approved_at")
        .eq("subject_type", "EMPLOYEE").eq("subject_reference", userId)
        .in("status", ["RENDERED", "SIGNING"]).limit(60),
      current.admin.from("office_employee_reference_ids")
        .select("reference_code").eq("employee_user_id", userId).maybeSingle(),
    ]);
    if (owned.error || subject.error || ref.error)
      throw new OfficeDocumentOtpError(503, "Assigned document or employee reference is unavailable");

    const docs = new Map<string, Document>();
    for (const doc of [...(owned.data || []), ...(subject.data || [])] as Document[])
      if (documentIsAssigned(doc, userId) && doc.approved_by && doc.approved_at) docs.set(doc.id, doc);

    const ids = [...docs.keys()];
    if (!ids.length) return {
      documents: [], employee_reference: ref.data?.reference_code || null,
      masked_email: mask(email), note: "Only real approved documents assigned to the current signer appear here.",
    };
    const renders = await current.admin.from("office_document_renders")
      .select("id,document_instance_id,output_format,sha256,status,generated_at")
      .in("document_instance_id", ids).eq("output_format", "PDF")
      .eq("status", "GENERATED").order("generated_at", { ascending: false }).limit(150);
    if (renders.error) throw new OfficeDocumentOtpError(503, "Approved document renders are unavailable");
    const latest = new Map<string, Render>();
    for (const row of (renders.data || []) as Render[]) {
      if (!latest.has(row.document_instance_id) && /^[a-f0-9]{64}$/.test(row.sha256))
        latest.set(row.document_instance_id, row);
    }
    const renderIds = [...latest.values()].map(row => row.id);
    const approvals = renderIds.length ? await current.admin.from("office_document_otp_approvals")
      .select(stampFields).eq("signer_user_id", userId).in("render_id", renderIds) :
      { data: [], error: null };
    if (approvals.error) throw new OfficeDocumentOtpError(503, "Document approval records unavailable");
    const approvedByRender = new Map((approvals.data || []).map(row => [row.render_id, row]));
    const documents = [...docs.values()].flatMap(doc => {
      const render = latest.get(doc.id);
      if (!render) return [];
      return [{
        id: doc.id, title: doc.title, document_code: doc.document_code,
        render_id: render.id, sha256: render.sha256,
        approved: approvedByRender.get(render.id) || null,
        can_approve: Boolean(ref.data?.reference_code && !approvedByRender.has(render.id)),
      }];
    });
    return {
      documents, employee_reference: ref.data?.reference_code || null,
      masked_email: mask(email),
      note: "Location is browser-reported with explicit permission, not independently verified GPS.",
    };
  } catch (error) {
    throw safeError(error, "Assigned documents could not be verified");
  }
}

export async function requestDocumentApprovalOtp(instanceId: string, renderId: string) {
  try {
    if (!documentOtpMailReady()) throw new OfficeDocumentOtpError(503, "Document OTP email is not configured");
    secret();
    const { current, email, userId, sessionHash } = await signerContext();
    const { doc } = await checkedDocument(current, instanceId, renderId);
    const id = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const started = await current.admin.rpc("office_document_otp_begin", {
      p_actor: userId, p_instance: instanceId, p_render: renderId,
      p_challenge: id, p_email: email, p_code_hash: digestCode(id, code),
      p_session_hash: sessionHash,
    });
    if (started.error || started.data !== true)
      throw new OfficeDocumentOtpError(409,
        "OTP request denied. Check your issued employee ID, document assignment and 60-second cooldown.");

    let outcome: "SENT" | "REJECTED" | "UNKNOWN" = "UNKNOWN";
    let providerId: string | null = null;
    try {
      providerId = await sendOfficeDocumentApprovalCode({
        recipientEmail: email, recipientName: current.identity.displayName || "KRAVIA employee",
        documentCode: doc.document_code, code, challengeId: id,
      });
      outcome = "SENT";
    } catch (error) {
      if (error instanceof DocumentOtpMailRejected || error instanceof DocumentOtpMailUnavailable)
        outcome = "REJECTED";
      else if (error instanceof DocumentOtpMailUnknown) outcome = "UNKNOWN";
    }
    const recorded = await current.admin.rpc("office_document_otp_delivery_result", {
      p_actor: userId, p_challenge: id, p_outcome: outcome,
      p_provider_id: providerId,
    });
    if (recorded.error || recorded.data !== true || outcome !== "SENT")
      throw new OfficeDocumentOtpError(503, "OTP email delivery was not confirmed. No document approval occurred.");

    return {
      challenge_id: id, masked_email: mask(email),
      expires_at: new Date(Date.now() + 7 * 60_000).toISOString(),
      document_code: doc.document_code,
    };
  } catch (error) {
    throw safeError(error, "Document OTP request could not be completed");
  }
}

export async function approveDocumentWithOtp(input: {
  challengeId: string; instanceId: string; renderId: string; code: string;
  latitude: number; longitude: number; accuracyM: number; capturedAt: string;
}) {
  try {
    secret();
    const { current, userId, sessionHash } = await signerContext();
    await checkedDocument(current, input.instanceId, input.renderId);
    const { data: challenge, error: challengeError } = await current.admin
      .from("office_document_otp_challenges")
      .select("document_instance_id,render_id").eq("id", input.challengeId)
      .eq("signer_user_id", userId).maybeSingle();
    if (challengeError || !challenge ||
       challenge.document_instance_id !== input.instanceId ||
       challenge.render_id !== input.renderId)
      throw new OfficeDocumentOtpError(409, "OTP is not bound to this document render");

    const { data, error } = await current.admin.rpc("office_document_otp_approve", {
      p_actor: userId, p_challenge: input.challengeId,
      p_code_hash: digestCode(input.challengeId, input.code),
      p_session_hash: sessionHash,
      p_lat: input.latitude, p_lon: input.longitude,
      p_accuracy: input.accuracyM, p_location_at: input.capturedAt,
    });
    if (error || typeof data !== "string")
      throw new OfficeDocumentOtpError(409,
        "Approval rejected. Check the OTP, live document status and fresh permitted location.");
    return { approval: await stampById(current, data) };
  } catch (error) {
    throw safeError(error, "Document OTP approval could not be completed");
  }
}
