import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  createDocumentClause,
  createDocumentClauseVersion,
  createDocumentInstance,
  createDocumentTemplate,
  createDocumentTemplateVersion,
  downloadOfficeDocumentRender,
  downloadOfficeSignedDocument,
  getOfficeDocumentStudioOverview,
  OfficeDocumentStudioError,
  publishDocumentClauseVersion,
  publishDocumentTemplateVersion,
  recordOfficeDocumentDelivery,
  recordOfficeSignedDocument,
  renderOfficeDocument,
  submitDocumentInstance,
  syncDocumentInstanceApproval,
} from "@/lib/office/document-studio-server";

const uuid = z.string().uuid();
const object = z.record(z.string(), z.unknown());
const array = z.array(z.unknown()).max(500);
const category = z.enum(["HR", "SECRETARIAL", "LEGAL", "FINANCE", "SALES", "OPERATIONS", "ENGINEERING", "COMPLIANCE", "GENERAL"]);
const classification = z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "BOARD", "FINANCE", "HR", "LEGAL", "SECURITY", "CUSTOMER_CONFIDENTIAL", "LEGAL_PRIVILEGED"]);
const output = z.enum(["PDF", "DOCX", "HTML", "XLSX"]);
const deliveryChannel = z.enum(["EMAIL", "SMS", "SECURE_LINK", "IN_APP", "ESIGN", "OTHER"]);
const signatureMethod = z.enum(["ESIGN", "DSC", "WET_SIGNATURE", "OTHER"]);

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_TEMPLATE"), code: z.string().trim().min(2).max(100), title: z.string().trim().min(3).max(220), category, department: z.string().trim().max(80).optional(), classification, creator_permission: z.string().trim().min(3).max(160), requires_approval: z.boolean(), outputs: z.array(output).min(1).max(4) }),
  z.object({ action: z.literal("CREATE_TEMPLATE_VERSION"), template_id: uuid, design: object, content: array, variables: object, clause_rules: array, source_reference: z.string().trim().min(3).max(1000), effective_from: z.string().date().optional(), effective_to: z.string().date().optional() }),
  z.object({ action: z.literal("PUBLISH_TEMPLATE_VERSION"), version_id: uuid }),
  z.object({ action: z.literal("CREATE_CLAUSE"), code: z.string().trim().min(2).max(100), title: z.string().trim().min(3).max(220), category: z.enum(["HR", "SECRETARIAL", "LEGAL", "FINANCE", "SALES", "OPERATIONS", "GENERAL"]), department: z.string().trim().max(80).optional() }),
  z.object({ action: z.literal("CREATE_CLAUSE_VERSION"), clause_id: uuid, content: z.string().trim().min(3).max(20000), variables: object, source_reference: z.string().trim().min(3).max(1000), effective_from: z.string().date().optional() }),
  z.object({ action: z.literal("PUBLISH_CLAUSE_VERSION"), version_id: uuid }),
  z.object({ action: z.literal("CREATE_INSTANCE"), template_code: z.string().trim().min(2).max(100), owner_user_id: uuid, subject_type: z.string().trim().min(2).max(80), subject_reference: z.string().trim().min(2).max(240), business_record_type: z.string().trim().max(100).optional(), business_record_key: z.string().trim().max(240).optional(), title: z.string().trim().min(3).max(220), input_snapshot: object }),
  z.object({ action: z.literal("SUBMIT_INSTANCE"), instance_id: uuid }),
  z.object({ action: z.literal("SYNC_INSTANCE"), instance_id: uuid }),
  z.object({ action: z.literal("RENDER"), instance_id: uuid, output_format: output }),
  z.object({
    action: z.literal("RECORD_DELIVERY"),
    instance_id: uuid,
    render_id: uuid,
    channel: deliveryChannel,
    destination_masked: z.string().trim().max(240).optional(),
    provider_reference: z.string().trim().max(500).optional(),
    event_type: z.string().trim().min(2).max(100),
    metadata: object,
  }),
]);

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof OfficeDocumentStudioError ? error.status : 500;
  const detail = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    const signed = search.get("signed");
    if (signed) {
      const parsed = uuid.safeParse(signed);
      if (!parsed.success) return NextResponse.json({ detail: "Invalid signed document evidence id" }, { status: 400 });
      const file = await downloadOfficeSignedDocument(parsed.data);
      return new NextResponse(file.bytes, {
        headers: {
          "Content-Type": file.mime_type,
          "Content-Disposition": `attachment; filename="${file.filename.replaceAll('"', "")}"`,
          "Cache-Control": "no-store",
          "ETag": `"${file.sha256}"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const download = search.get("download");
    if (download) {
      const parsed = uuid.safeParse(download);
      if (!parsed.success) return NextResponse.json({ detail: "Invalid document render id" }, { status: 400 });
      const file = await downloadOfficeDocumentRender(parsed.data);
      return new NextResponse(file.bytes, {
        headers: {
          "Content-Type": file.mime_type,
          "Content-Disposition": `attachment; filename="${file.filename.replaceAll('"', "")}"`,
          "Cache-Control": "no-store",
          "ETag": `"${file.sha256}"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return NextResponse.json(await getOfficeDocumentStudioOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to load Document Studio");
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin document mutation is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid document request" }, { status: 400 });
  try {
    const input = parsed.data;
    let result: unknown;
    switch (input.action) {
      case "CREATE_TEMPLATE": result = await createDocumentTemplate({ code: input.code, title: input.title, category: input.category, department: input.department, classification: input.classification, creatorPermission: input.creator_permission, requiresApproval: input.requires_approval, outputs: input.outputs }); break;
      case "CREATE_TEMPLATE_VERSION": result = await createDocumentTemplateVersion({ templateId: input.template_id, design: input.design, content: input.content, variables: input.variables, clauseRules: input.clause_rules, sourceReference: input.source_reference, effectiveFrom: input.effective_from, effectiveTo: input.effective_to }); break;
      case "PUBLISH_TEMPLATE_VERSION": result = await publishDocumentTemplateVersion(input.version_id); break;
      case "CREATE_CLAUSE": result = await createDocumentClause({ code: input.code, title: input.title, category: input.category, department: input.department }); break;
      case "CREATE_CLAUSE_VERSION": result = await createDocumentClauseVersion({ clauseId: input.clause_id, content: input.content, variables: input.variables, sourceReference: input.source_reference, effectiveFrom: input.effective_from }); break;
      case "PUBLISH_CLAUSE_VERSION": result = await publishDocumentClauseVersion(input.version_id); break;
      case "CREATE_INSTANCE": result = await createDocumentInstance({ templateCode: input.template_code, ownerUserId: input.owner_user_id, subjectType: input.subject_type, subjectReference: input.subject_reference, businessRecordType: input.business_record_type, businessRecordKey: input.business_record_key, title: input.title, inputSnapshot: input.input_snapshot }); break;
      case "SUBMIT_INSTANCE": result = await submitDocumentInstance(input.instance_id); break;
      case "SYNC_INSTANCE": result = await syncDocumentInstanceApproval(input.instance_id); break;
      case "RENDER": result = await renderOfficeDocument(input.instance_id, input.output_format); break;
      case "RECORD_DELIVERY": result = await recordOfficeDocumentDelivery({
        instanceId: input.instance_id,
        renderId: input.render_id,
        channel: input.channel,
        destinationMasked: input.destination_masked,
        providerReference: input.provider_reference,
        eventType: input.event_type,
        metadata: input.metadata,
      }); break;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to update Document Studio");
  }
}


const signedUploadSchema = z.object({
  instance_id: uuid,
  render_id: uuid,
  provider: z.string().trim().min(2).max(100),
  provider_reference: z.string().trim().max(500).optional(),
  signature_method: signatureMethod,
  signer_reference_masked: z.string().trim().max(240).optional(),
  signed_at: z.string().datetime({ offset: true }),
  evidence: object,
});

export async function PUT(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin signed-document upload is not allowed" }, { status: 403 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ detail: "Invalid signed-document upload" }, { status: 400 });
  }

  const file = form.get("file");
  const evidenceRaw = form.get("evidence");
  let evidence: Record<string, unknown> = {};
  if (typeof evidenceRaw === "string" && evidenceRaw.trim()) {
    try {
      const parsed = JSON.parse(evidenceRaw);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error();
      evidence = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ detail: "Signature evidence must be a valid JSON object" }, { status: 400 });
    }
  }

  const parsed = signedUploadSchema.safeParse({
    instance_id: form.get("instance_id"),
    render_id: form.get("render_id"),
    provider: form.get("provider"),
    provider_reference: form.get("provider_reference") || undefined,
    signature_method: form.get("signature_method"),
    signer_reference_masked: form.get("signer_reference_masked") || undefined,
    signed_at: form.get("signed_at"),
    evidence,
  });
  if (!parsed.success || !(file instanceof File)) {
    return NextResponse.json({ detail: "Invalid signed-document evidence request" }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ detail: "Signed PDF exceeds the 50 MB evidence limit" }, { status: 413 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await recordOfficeSignedDocument({
      instanceId: parsed.data.instance_id,
      renderId: parsed.data.render_id,
      provider: parsed.data.provider,
      providerReference: parsed.data.provider_reference,
      signatureMethod: parsed.data.signature_method,
      signerReferenceMasked: parsed.data.signer_reference_masked,
      signedAt: parsed.data.signed_at,
      evidence: parsed.data.evidence,
      bytes,
      mimeType: file.type,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to record signed document evidence");
  }
}
