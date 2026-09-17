import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { requireOfficeRuntimeEnvironment } from "@/lib/env/office";
import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";

export class OfficeDocumentStudioError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeDocumentStudioError";
  }
}

type Actor = Awaited<ReturnType<typeof requireOfficeActor>>;
type Row = Record<string, unknown>;

async function actor(): Promise<Actor> {
  try { return await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeDocumentStudioError(error.status, error.message);
    throw error;
  }
}

async function decision(current: Actor, permission: string, ownerUserId?: string | null, department?: string | null) {
  const scopes: OfficeResourceScope[] = [
    { type: "COMPANY" },
    ...(department ? [{ type: "DEPARTMENT" as const, key: department }] : []),
    ...(ownerUserId ? [{ type: "OWN" as const, ownerUserId }] : []),
  ];
  for (const resource of scopes) {
    const result = await resolveOfficePermission(current.admin, current.identity, permission, resource);
    if (result.allowed) return result;
  }
  return null;
}

async function requirePermission(current: Actor, permission: string, ownerUserId?: string | null, department?: string | null) {
  const result = await decision(current, permission, ownerUserId, department);
  if (!result) throw new OfficeDocumentStudioError(403, `${permission} permission is required`);
  return result;
}

function fail(error: { message?: string } | null, message: string) {
  if (error) throw new OfficeDocumentStudioError(503, message);
}

function text(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }

export async function getOfficeDocumentStudioOverview() {
  const current = await actor();
  const [canReadTemplates, canManageTemplates, canPublishTemplates, canReadInstances, canReviewInstances, canRender] = await Promise.all([
    decision(current, "document.template.read", current.identity.userId, current.identity.department),
    decision(current, "document.template.manage", current.identity.userId, current.identity.department),
    decision(current, "document.template.publish", current.identity.userId, current.identity.department),
    decision(current, "document.instance.read", current.identity.userId, current.identity.department),
    decision(current, "document.instance.review", current.identity.userId, current.identity.department),
    decision(current, "document.render", current.identity.userId, current.identity.department),
  ]);
  const ownerOverride = current.identity.roles.includes("OWNER");
  if (!canReadTemplates && !canReadInstances && !ownerOverride) throw new OfficeDocumentStudioError(403, "Document Studio permission is required");

  const [templates, versions, clauses, clauseVersions, instances, renders, identities] = await Promise.all([
    canReadTemplates || ownerOverride ? current.admin.from("office_document_templates").select("id,template_code,title,category,owner_department,classification,required_creator_permission,requires_instance_approval,allowed_outputs,status,created_by,created_at,updated_at").eq("status", "ACTIVE").order("category").order("title") : Promise.resolve({ data: [], error: null }),
    canReadTemplates || ownerOverride ? current.admin.from("office_document_template_versions").select("id,template_id,version,design_schema,content_schema,variables_schema,clause_rules,clause_snapshot,source_reference,source_hash,effective_from,effective_to,status,created_by,published_by,published_at,created_at,updated_at").order("version", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    canReadTemplates || ownerOverride ? current.admin.from("office_document_clauses").select("id,clause_code,title,category,owner_department,status,created_by,created_at,updated_at").eq("status", "ACTIVE").order("category").order("title") : Promise.resolve({ data: [], error: null }),
    canReadTemplates || ownerOverride ? current.admin.from("office_document_clause_versions").select("id,clause_id,version,content,variables_schema,source_reference,content_hash,effective_from,status,created_by,published_by,published_at,created_at,updated_at").order("version", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    canReadInstances || ownerOverride ? current.admin.from("office_document_instances").select("id,document_code,template_id,template_version_id,subject_type,subject_reference,business_record_type,business_record_key,title,classification,owner_user_id,input_hash,approval_request_id,status,created_by,approved_by,approved_at,signed_at,delivered_at,created_at,updated_at").order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    canReadInstances || ownerOverride ? current.admin.from("office_document_renders").select("id,document_instance_id,output_format,mime_type,storage_reference,sha256,byte_size,status,generated_by,generated_at").order("generated_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null }),
    current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status", "ACTIVE").order("display_name"),
  ]);
  for (const result of [templates, versions, clauses, clauseVersions, instances, renders, identities]) fail(result.error, "Document Studio data is temporarily unavailable");

  const requestIds = (instances.data ?? []).map((row) => row.approval_request_id).filter((value): value is string => typeof value === "string" && Boolean(value));
  const approvals = requestIds.length ? await current.admin.from("office_requests").select("id,title,status,current_step_order,due_at,submitted_at,completed_at,updated_at").in("id", requestIds) : { data: [], error: null };
  fail(approvals.error, "Document approval state is temporarily unavailable");

  const templateRows = (templates.data ?? []) as Row[];
  const creatorPermissions = Array.from(new Set(templateRows.map((row) => text(row.required_creator_permission)).filter(Boolean)));
  const permissionMap = new Map<string, boolean>();
  for (const permission of creatorPermissions) {
    permissionMap.set(permission, Boolean(await decision(current, permission, current.identity.userId, current.identity.department)) || ownerOverride);
  }

  return {
    actor: { user_id: current.identity.userId, roles: current.identity.roles, department: current.identity.department ?? null },
    capabilities: {
      read_templates: Boolean(canReadTemplates) || ownerOverride,
      manage_templates: Boolean(canManageTemplates) || ownerOverride,
      publish_templates: Boolean(canPublishTemplates) || ownerOverride,
      read_instances: Boolean(canReadInstances) || ownerOverride,
      review_instances: Boolean(canReviewInstances) || ownerOverride,
      render: Boolean(canRender) || ownerOverride,
    },
    creator_permissions: Object.fromEntries(permissionMap),
    templates: templates.data ?? [],
    versions: versions.data ?? [],
    clauses: clauses.data ?? [],
    clause_versions: clauseVersions.data ?? [],
    instances: instances.data ?? [],
    renders: renders.data ?? [],
    identities: identities.data ?? [],
    approvals: approvals.data ?? [],
    disclaimer: "The canonical document is the published template version plus immutable input snapshot. PDF, DOCX, HTML and XLSX are rendered outputs and never replace historical source data.",
  };
}

export async function createDocumentTemplate(input: { code: string; title: string; category: string; department?: string; classification: string; creatorPermission: string; requiresApproval: boolean; outputs: string[] }) {
  const current = await actor();
  await requirePermission(current, "document.template.manage", current.identity.userId, input.department || current.identity.department);
  const { data, error } = await current.admin.rpc("office_document_template_create", { p_actor: current.identity.userId, p_code: input.code, p_title: input.title, p_category: input.category, p_department: input.department?.trim() || null, p_classification: input.classification, p_creator_permission: input.creatorPermission, p_requires_approval: input.requiresApproval, p_outputs: input.outputs });
  if (error || typeof data !== "string") throw new OfficeDocumentStudioError(400, error?.message ?? "Unable to create document template");
  return { template_id: data };
}

export async function createDocumentTemplateVersion(input: { templateId: string; design: Record<string, unknown>; content: unknown[]; variables: Record<string, unknown>; clauseRules: unknown[]; sourceReference: string; effectiveFrom?: string; effectiveTo?: string }) {
  const current = await actor();
  await requirePermission(current, "document.template.manage", current.identity.userId, current.identity.department);
  const { data, error } = await current.admin.rpc("office_document_template_version_create", { p_actor: current.identity.userId, p_template: input.templateId, p_design: input.design, p_content: input.content, p_variables: input.variables, p_clause_rules: input.clauseRules, p_source: input.sourceReference, p_effective_from: input.effectiveFrom ?? null, p_effective_to: input.effectiveTo ?? null });
  if (error || typeof data !== "string") throw new OfficeDocumentStudioError(400, error?.message ?? "Unable to create template version");
  return { template_version_id: data };
}

export async function publishDocumentTemplateVersion(versionId: string) {
  const current = await actor();
  await requirePermission(current, "document.template.publish", current.identity.userId, current.identity.department);
  const { data, error } = await current.admin.rpc("office_document_template_version_publish", { p_actor: current.identity.userId, p_version: versionId });
  if (error || data !== true) throw new OfficeDocumentStudioError(400, error?.message ?? "Unable to publish template version");
  return { published: true };
}

export async function createDocumentClause(input: { code: string; title: string; category: string; department?: string }) {
  const current = await actor(); await requirePermission(current, "document.template.manage", current.identity.userId, input.department || current.identity.department);
  const { data, error } = await current.admin.rpc("office_document_clause_create", { p_actor: current.identity.userId, p_code: input.code, p_title: input.title, p_category: input.category, p_department: input.department?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeDocumentStudioError(400, error?.message ?? "Unable to create clause");
  return { clause_id: data };
}

export async function createDocumentClauseVersion(input: { clauseId: string; content: string; variables: Record<string, unknown>; sourceReference: string; effectiveFrom?: string }) {
  const current = await actor(); await requirePermission(current, "document.template.manage", current.identity.userId, current.identity.department);
  const { data, error } = await current.admin.rpc("office_document_clause_version_create", { p_actor: current.identity.userId, p_clause: input.clauseId, p_content: input.content, p_variables: input.variables, p_source: input.sourceReference, p_effective_from: input.effectiveFrom ?? null });
  if (error || typeof data !== "string") throw new OfficeDocumentStudioError(400, error?.message ?? "Unable to create clause version");
  return { clause_version_id: data };
}

export async function publishDocumentClauseVersion(versionId: string) {
  const current = await actor(); await requirePermission(current, "document.template.publish", current.identity.userId, current.identity.department);
  const { data, error } = await current.admin.rpc("office_document_clause_publish", { p_actor: current.identity.userId, p_version: versionId });
  if (error || data !== true) throw new OfficeDocumentStudioError(400, error?.message ?? "Unable to publish clause version");
  return { published: true };
}

export async function createDocumentInstance(input: { templateCode: string; ownerUserId: string; subjectType: string; subjectReference: string; businessRecordType?: string; businessRecordKey?: string; title: string; inputSnapshot: Record<string, unknown> }) {
  const current = await actor();
  const template = await current.admin.from("office_document_templates").select("required_creator_permission,owner_department").eq("template_code", input.templateCode.trim().toUpperCase()).eq("status", "ACTIVE").maybeSingle();
  if (template.error || !template.data) throw new OfficeDocumentStudioError(404, "Document template not found");
  await requirePermission(current, template.data.required_creator_permission, current.identity.userId, template.data.owner_department || current.identity.department);
  const { data, error } = await current.admin.rpc("office_document_instance_create", { p_actor: current.identity.userId, p_template_code: input.templateCode, p_owner: input.ownerUserId, p_subject_type: input.subjectType, p_subject_ref: input.subjectReference, p_business_type: input.businessRecordType?.trim() || null, p_business_key: input.businessRecordKey?.trim() || null, p_title: input.title, p_input: input.inputSnapshot });
  if (error || typeof data !== "string") throw new OfficeDocumentStudioError(400, error?.message ?? "Unable to create document instance");
  return { document_instance_id: data };
}

export async function submitDocumentInstance(instanceId: string) {
  const current = await actor();
  const { data, error } = await current.admin.rpc("office_document_instance_submit", { p_actor: current.identity.userId, p_instance: instanceId });
  if (error) throw new OfficeDocumentStudioError(400, error.message);
  return { approval_request_id: typeof data === "string" ? data : null, approved_without_workflow: data == null };
}

export async function syncDocumentInstanceApproval(instanceId: string) {
  const current = await actor();
  const { data, error } = await current.admin.rpc("office_document_instance_sync_approval", { p_actor: current.identity.userId, p_instance: instanceId });
  if (error || typeof data !== "string") throw new OfficeDocumentStudioError(400, error?.message ?? "Unable to synchronize document approval");
  return { status: data };
}

export async function renderOfficeDocument(instanceId: string, outputFormat: "PDF" | "DOCX" | "HTML" | "XLSX") {
  const current = await actor();
  await requirePermission(current, "document.render", current.identity.userId, current.identity.department);
  const instanceResult = await current.admin.from("office_document_instances").select("id,document_code,title,status,template_id,template_version_id,created_by,owner_user_id,input_snapshot").eq("id", instanceId).maybeSingle();
  if (instanceResult.error || !instanceResult.data) throw new OfficeDocumentStudioError(404, "Document instance not found");
  const instance = instanceResult.data;
  if (!["APPROVED", "RENDERED", "SIGNING", "SIGNED"].includes(instance.status)) throw new OfficeDocumentStudioError(409, "Document must be approved before rendering");
  const [templateResult, versionResult] = await Promise.all([
    current.admin.from("office_document_templates").select("template_code,allowed_outputs,classification").eq("id", instance.template_id).maybeSingle(),
    current.admin.from("office_document_template_versions").select("version,design_schema,content_schema,clause_rules,clause_snapshot,source_hash,status").eq("id", instance.template_version_id).maybeSingle(),
  ]);
  if (templateResult.error || versionResult.error || !templateResult.data || !versionResult.data) throw new OfficeDocumentStudioError(409, "Canonical document template snapshot is unavailable");
  if (!templateResult.data.allowed_outputs.includes(outputFormat)) throw new OfficeDocumentStudioError(400, "Output format is not allowed by this template");
  const runtime = requireOfficeRuntimeEnvironment();
  const response = await fetch(`${runtime.OFFICE_API_ORIGIN}/api/v1/document-engine/render`, {
    method: "POST",
    headers: { Authorization: `Bearer ${current.session.access_token}`, "Content-Type": "application/json", Accept: "application/octet-stream" },
    body: JSON.stringify({ document_code: instance.document_code, title: instance.title, output_format: outputFormat, design_schema: versionResult.data.design_schema, content_schema: versionResult.data.content_schema, input_snapshot: instance.input_snapshot, clause_snapshot: versionResult.data.clause_snapshot, clause_rules: versionResult.data.clause_rules }),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new OfficeDocumentStudioError(response.status, body?.detail ?? "Document renderer rejected the canonical snapshot");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw new OfficeDocumentStudioError(502, "Document renderer returned an invalid output size");
  const digest = createHash("sha256").update(bytes).digest("hex");
  const rendererHash = (response.headers.get("x-document-sha256") || response.headers.get("etag") || "").replaceAll('"', "").trim().toLowerCase();
  if (rendererHash && rendererHash !== digest) throw new OfficeDocumentStudioError(502, "Document renderer integrity check failed");
  const mime = response.headers.get("content-type")?.split(";")[0] || ({ PDF: "application/pdf", DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", HTML: "text/html", XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } as const)[outputFormat];
  const extension = ({ PDF: "pdf", DOCX: "docx", HTML: "html", XLSX: "xlsx" } as const)[outputFormat];
  const renderId = randomUUID();
  const storageReference = `${instance.document_code}/${renderId}.${extension}`;
  const upload = await current.admin.storage.from("office-documents").upload(storageReference, bytes, { contentType: mime, upsert: false, cacheControl: "0" });
  if (upload.error) throw new OfficeDocumentStudioError(503, "Document output could not be written to the private vault");
  const record = await current.admin.rpc("office_document_record_render", { p_actor: current.identity.userId, p_instance: instance.id, p_render: renderId, p_format: outputFormat, p_mime: mime, p_storage: storageReference, p_sha: digest, p_size: bytes.length });
  if (record.error || record.data !== renderId) {
    await current.admin.storage.from("office-documents").remove([storageReference]);
    throw new OfficeDocumentStudioError(503, record.error?.message ?? "Document render metadata could not be committed");
  }
  return { render_id: renderId, sha256: digest, byte_size: bytes.length, output_format: outputFormat, download_path: `/api/office-documents?download=${renderId}` };
}

export async function downloadOfficeDocumentRender(renderId: string) {
  const current = await actor();
  const renderResult = await current.admin.from("office_document_renders").select("id,document_instance_id,output_format,mime_type,storage_reference,sha256,byte_size,status").eq("id", renderId).maybeSingle();
  if (renderResult.error || !renderResult.data) throw new OfficeDocumentStudioError(404, "Document output not found");
  const instanceResult = await current.admin.from("office_document_instances").select("document_code,title,created_by,owner_user_id,classification").eq("id", renderResult.data.document_instance_id).maybeSingle();
  if (instanceResult.error || !instanceResult.data) throw new OfficeDocumentStudioError(404, "Document instance not found");
  const owns = instanceResult.data.created_by === current.identity.userId || instanceResult.data.owner_user_id === current.identity.userId;
  if (!owns && !await decision(current, "document.instance.read", current.identity.userId, current.identity.department)) throw new OfficeDocumentStudioError(403, "Document read permission is required");
  const download = await current.admin.storage.from("office-documents").download(renderResult.data.storage_reference);
  if (download.error || !download.data) throw new OfficeDocumentStudioError(503, "Document output is unavailable from the private vault");
  const bytes = Buffer.from(await download.data.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== renderResult.data.sha256) throw new OfficeDocumentStudioError(500, "Stored document integrity check failed");
  const extension = ({ PDF: "pdf", DOCX: "docx", HTML: "html", XLSX: "xlsx" } as Record<string, string>)[renderResult.data.output_format] ?? "bin";
  return { bytes, mime_type: renderResult.data.mime_type, filename: `${instanceResult.data.document_code}.${extension}`, sha256: digest };
}
