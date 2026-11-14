import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { getOfficeSessionContext } from "@/lib/office/auth-server";
import {sourceVisibleDocumentInstances} from "@/lib/office/document-source-scope";
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

async function hasCurrentOfficeDepartment(current:Actor,department:string){
 const {count,error}=await current.admin.from("office_job_assignments")
  .select("user_id",{count:"exact",head:true})
  .eq("user_id",current.identity.userId).eq("department_code",department).eq("status","ACTIVE");
 if(error||typeof count!=="number")throw new OfficeDocumentStudioError(503,"Department authority unavailable");
 return count>0;
}
/** The source instance, not the actor's current department or their creator role,
 * determines read, render, delivery and signature authority. */
async function requireInstanceAuthority(
 current:Actor,permission:string,
 instance:{owner_user_id?:string|null;template_id?:string|null},
){
 const actorId=current.identity.userId;
 const company=await resolveOfficePermission(current.admin,current.identity,permission,{type:"COMPANY"});
 if(company.allowed)return;
 if(instance.owner_user_id===actorId){
  const own=await resolveOfficePermission(current.admin,current.identity,permission,
   {type:"OWN",ownerUserId:actorId});
  if(own.allowed)return;
 }
 if(instance.template_id){
  const {data:template,error}=await current.admin.from("office_document_templates")
   .select("owner_department").eq("id",instance.template_id).maybeSingle();
  if(error)throw new OfficeDocumentStudioError(503,"Document department authority unavailable");
  const department=template?.owner_department;
  if(department&&await hasCurrentOfficeDepartment(current,department)){
   const scoped=await resolveOfficePermission(current.admin,current.identity,permission,
    {type:"DEPARTMENT",key:department});
   if(scoped.allowed)return;
  }
 }
 throw new OfficeDocumentStudioError(403,"Record-level "+permission+" permission is required");
}

function text(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }

export async function getOfficeDocumentStudioOverview() {
  const current = await actor();
  const [canReadTemplates, canManageTemplates, canPublishTemplates, canReadInstances, canReviewInstances, canRender, canSign, canDeliver] = await Promise.all([
    decision(current, "document.template.read", current.identity.userId, current.identity.department),
    decision(current, "document.template.manage", current.identity.userId, current.identity.department),
    decision(current, "document.template.publish", current.identity.userId, current.identity.department),
    decision(current, "document.instance.read", current.identity.userId, current.identity.department),
    decision(current, "document.instance.review", current.identity.userId, current.identity.department),
    decision(current, "document.render", current.identity.userId, current.identity.department),
    decision(current, "document.signature.record", current.identity.userId, current.identity.department),
    decision(current, "document.delivery.record", current.identity.userId, current.identity.department),
  ]);
  const ownerSigningReviewer = current.identity.roles.includes("OWNER");
  if (!canReadTemplates && !canReadInstances) throw new OfficeDocumentStudioError(403, "Document Studio permission is required");

  const [templates, versions, clauses, clauseVersions, instances, renders, signatures, deliveries, identities] = await Promise.all([
    canReadTemplates ? current.admin.from("office_document_templates").select("id,template_code,title,category,owner_department,classification,required_creator_permission,requires_instance_approval,allowed_outputs,status,created_by,created_at,updated_at").eq("status", "ACTIVE").order("category").order("title") : Promise.resolve({ data: [], error: null }),
    canReadTemplates ? current.admin.from("office_document_template_versions").select("id,template_id,version,design_schema,content_schema,variables_schema,clause_rules,clause_snapshot,source_reference,source_hash,effective_from,effective_to,status,created_by,published_by,published_at,created_at,updated_at").order("version", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    canReadTemplates ? current.admin.from("office_document_clauses").select("id,clause_code,title,category,owner_department,status,created_by,created_at,updated_at").eq("status", "ACTIVE").order("category").order("title") : Promise.resolve({ data: [], error: null }),
    canReadTemplates ? current.admin.from("office_document_clause_versions").select("id,clause_id,version,content,variables_schema,source_reference,content_hash,effective_from,status,created_by,published_by,published_at,created_at,updated_at").order("version", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    canReadInstances ? current.admin.from("office_document_instances").select("id,document_code,template_id,template_version_id,subject_type,subject_reference,business_record_type,business_record_key,title,classification,owner_user_id,input_hash,approval_request_id,status,created_by,approved_by,approved_at,signed_at,delivered_at,created_at,updated_at").order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    canReadInstances ? current.admin.from("office_document_renders").select("id,document_instance_id,output_format,mime_type,storage_reference,sha256,byte_size,status,generated_by,generated_at").order("generated_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null }),
    canReadInstances ? current.admin.from("office_document_signature_evidence").select("id,document_instance_id,source_render_id,provider,provider_reference,signature_method,signer_reference_masked,signed_sha256,byte_size,status,signed_at,recorded_by,recorded_at").order("recorded_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null }),
    canReadInstances ? current.admin.from("office_document_delivery_events").select("id,delivery_code,document_instance_id,render_id,channel,destination_masked,provider_reference,event_type,metadata,actor_user_id,created_at").order("created_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null }),
    current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status", "ACTIVE").order("display_name"),
  ]);
  for (const result of [templates, versions, clauses, clauseVersions, instances, renders, signatures, deliveries, identities]) fail(result.error, "Document Studio data is temporarily unavailable");

  // External signatory evidence is high-risk: only the current AAL2 Owner
  // can read attestations, and no record is created by opening the dashboard.
  const signingReviews = ownerSigningReviewer && canReadInstances
    ? await current.admin.from("office_signing_issuance_reviews")
      .select("delivery_event_id,status,reviewed_by,reviewed_at,revoked_at")
      .order("reviewed_at", { ascending: false }).limit(500)
    : { data: [], error: null };
  fail(signingReviews.error, "Signing issuance review state unavailable");

  // The service client bypasses PostgREST RLS: narrow every response to the
  // canonical *record* owner, a true COMPANY grant, or a currently assigned
  // department whose template is the source of that document instance.
  const actorId=current.identity.userId;
  const [companyInstance,ownInstance,departmentInstance,
    companyTemplate,ownTemplate,departmentTemplate]=await Promise.all([
    resolveOfficePermission(current.admin,current.identity,"document.instance.read",{type:"COMPANY"}),
    resolveOfficePermission(current.admin,current.identity,"document.instance.read",{type:"OWN",ownerUserId:actorId}),
    current.identity.department
     ?resolveOfficePermission(current.admin,current.identity,"document.instance.read",
       {type:"DEPARTMENT",key:current.identity.department})
     :Promise.resolve({allowed:false}),
    resolveOfficePermission(current.admin,current.identity,"document.template.read",{type:"COMPANY"}),
    resolveOfficePermission(current.admin,current.identity,"document.template.read",{type:"OWN",ownerUserId:actorId}),
    current.identity.department
     ?resolveOfficePermission(current.admin,current.identity,"document.template.read",
       {type:"DEPARTMENT",key:current.identity.department})
     :Promise.resolve({allowed:false}),
  ]);
  const department=current.identity.department;
  const wantsDepartment=Boolean(department&&(departmentInstance.allowed||departmentTemplate.allowed));
  const validDepartment=wantsDepartment&&department
   ?await hasCurrentOfficeDepartment(current,department):false;
  const templateIds=[...new Set((instances.data??[]).map(row=>row.template_id)
   .filter((id):id is string=>typeof id==="string"&&Boolean(id)))];
  const templateScopeResult=templateIds.length
   ?await current.admin.from("office_document_templates")
     .select("id,owner_department").in("id",templateIds)
   :{data:[],error:null};
  fail(templateScopeResult.error,"Document source department references are unavailable");
  const departmentInstanceTemplates=new Set(
   validDepartment&&departmentInstance.allowed
    ?(templateScopeResult.data??[]).filter(row=>row.owner_department===department)
       .map(row=>String(row.id)) :[]);
  const visibleInstances=sourceVisibleDocumentInstances(instances.data??[],actorId,
   companyInstance.allowed,ownInstance.allowed,departmentInstanceTemplates);
  const visibleInstanceIds=new Set(visibleInstances.map(row=>String(row.id)));
  const visibleRenders=(renders.data??[]).filter(row=>visibleInstanceIds.has(String(row.document_instance_id)));
  const visibleSignatures=(signatures.data??[]).filter(row=>visibleInstanceIds.has(String(row.document_instance_id)));
  const visibleDeliveries=(deliveries.data??[]).filter(row=>visibleInstanceIds.has(String(row.document_instance_id)));
  const visibleDeliveryIds=new Set(visibleDeliveries.map(row=>String(row.id)));
  const visibleTemplates=(templates.data??[]).filter(row=>
   companyTemplate.allowed ||
   (ownTemplate.allowed&&row.created_by===actorId) ||
   (validDepartment&&departmentTemplate.allowed&&row.owner_department===department));
  const visibleTemplateIds=new Set(visibleTemplates.map(row=>String(row.id)));
  const visibleVersions=(versions.data??[]).filter(row=>visibleTemplateIds.has(String(row.template_id)));
  const visibleClauses=(clauses.data??[]).filter(row=>
   companyTemplate.allowed ||
   (ownTemplate.allowed&&row.created_by===actorId) ||
   (validDepartment&&departmentTemplate.allowed&&row.owner_department===department));
  const visibleClauseIds=new Set(visibleClauses.map(row=>String(row.id)));
  const visibleClauseVersions=(clauseVersions.data??[]).filter(row=>visibleClauseIds.has(String(row.clause_id)));
  const requestIds = visibleInstances.map((row) => row.approval_request_id).filter((value): value is string => typeof value === "string" && Boolean(value));
  const approvals = requestIds.length ? await current.admin.from("office_requests").select("id,title,status,current_step_order,due_at,submitted_at,completed_at,updated_at").in("id", requestIds) : { data: [], error: null };
  fail(approvals.error, "Document approval state is temporarily unavailable");

  const templateRows = visibleTemplates as Row[];
  const creatorPermissions = Array.from(new Set(templateRows.map((row) => text(row.required_creator_permission)).filter(Boolean)));
  const permissionMap = new Map<string, boolean>();
  for (const permission of creatorPermissions) {
    permissionMap.set(permission, Boolean(await decision(current, permission, current.identity.userId, current.identity.department)));
  }

  return {
    actor: { user_id: current.identity.userId, roles: current.identity.roles, department: current.identity.department ?? null },
    capabilities: {
      read_templates: Boolean(canReadTemplates),
      manage_templates: Boolean(canManageTemplates),
      publish_templates: Boolean(canPublishTemplates),
      read_instances: Boolean(canReadInstances),
      review_instances: Boolean(canReviewInstances),
      render: Boolean(canRender),
      sign: Boolean(canSign),
      deliver: Boolean(canDeliver),
    },
    creator_permissions: Object.fromEntries(permissionMap),
    templates: visibleTemplates,
    versions: visibleVersions,
    clauses: visibleClauses,
    clause_versions: visibleClauseVersions,
    instances: visibleInstances,
    renders: visibleRenders,
    signatures: visibleSignatures,
    deliveries: visibleDeliveries,
    signing_reviews: (signingReviews.data??[]).filter(row=>visibleDeliveryIds.has(String(row.delivery_event_id))),
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
  const instanceResult = await current.admin.from("office_document_instances").select("id,document_code,title,status,template_id,template_version_id,created_by,owner_user_id,input_snapshot").eq("id", instanceId).maybeSingle();
  if (instanceResult.error || !instanceResult.data) throw new OfficeDocumentStudioError(404, "Document instance not found");
  const instance = instanceResult.data;
  await requireInstanceAuthority(current,"document.instance.read",instance);
  await requireInstanceAuthority(current,"document.render",instance);
  if (!["APPROVED", "RENDERED", "SIGNING", "SIGNED"].includes(instance.status)) throw new OfficeDocumentStudioError(409, "Document must be approved before rendering");
  const [templateResult, versionResult] = await Promise.all([
    current.admin.from("office_document_templates").select("template_code,allowed_outputs,classification").eq("id", instance.template_id).maybeSingle(),
    current.admin.from("office_document_template_versions").select("version,design_schema,content_schema,clause_rules,clause_snapshot,source_hash,status").eq("id", instance.template_version_id).maybeSingle(),
  ]);
  if (templateResult.error || versionResult.error || !templateResult.data || !versionResult.data) throw new OfficeDocumentStudioError(409, "Canonical document template snapshot is unavailable");
  if (!templateResult.data.allowed_outputs.includes(outputFormat)) throw new OfficeDocumentStudioError(400, "Output format is not allowed by this template");
  const runtimeOrigin = getOfficeRuntimeOrigin();
  if (!runtimeOrigin) throw new OfficeDocumentStudioError(503, "KRAVIA Office document renderer is not configured");
  const session = await getOfficeSessionContext();
  if (!session || session.identity.userId !== current.identity.userId) throw new OfficeDocumentStudioError(401, "Office sign-in required");
  if (session.identity.aal !== "aal2") throw new OfficeDocumentStudioError(403, "AAL2 verification is required");
  const response = await fetch(`${runtimeOrigin}/api/v1/document-engine/render`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.session.access_token}`, "Content-Type": "application/json", Accept: "application/octet-stream" },
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

export async function queueOfficeSignedDocumentEvidence(input: {
  instanceId: string;
  renderId: string;
  provider: string;
  providerReference?: string;
  signatureMethod: "ESIGN" | "DSC" | "WET_SIGNATURE" | "OTHER";
  signerReferenceMasked?: string;
  signedAt: string;
  evidence: Record<string, unknown>;
  bytes: Buffer;
  mimeType: string;
}) {
  const current = await actor();
  const instanceResult = await current.admin
    .from("office_document_instances")
    .select("id,document_code,owner_user_id,created_by,status,template_id")
    .eq("id", input.instanceId)
    .maybeSingle();
  if (instanceResult.error || !instanceResult.data) throw new OfficeDocumentStudioError(404, "Document instance not found");
  const instance = instanceResult.data;
  await requireInstanceAuthority(current,"document.signature.record",instance);

  const renderResult = await current.admin
    .from("office_document_renders")
    .select("id,document_instance_id,output_format,status")
    .eq("id", input.renderId)
    .maybeSingle();
  if (renderResult.error || !renderResult.data || renderResult.data.document_instance_id !== instance.id) {
    throw new OfficeDocumentStudioError(404, "Source document output not found");
  }
  if (renderResult.data.output_format !== "PDF") throw new OfficeDocumentStudioError(400, "Signed evidence must reference a PDF output");
  if (!["RENDERED", "SIGNING", "SIGNED"].includes(instance.status)) {
    throw new OfficeDocumentStudioError(409, "Document must be rendered before signed evidence can be recorded");
  }
  if (input.mimeType !== "application/pdf" || !input.bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new OfficeDocumentStudioError(415, "Signed evidence must be a valid PDF");
  }
  if (!input.bytes.length || input.bytes.length > 50 * 1024 * 1024) {
    throw new OfficeDocumentStudioError(413, "Signed PDF exceeds the 50 MB evidence limit");
  }
  const signedAt = new Date(input.signedAt);
  if (Number.isNaN(signedAt.getTime()) || signedAt.getTime() > Date.now() + 5 * 60_000) {
    throw new OfficeDocumentStudioError(400, "Valid signature timestamp is required");
  }

  const runtimeOrigin = getOfficeRuntimeOrigin();
  if (!runtimeOrigin) throw new OfficeDocumentStudioError(503, "KRAVIA Office file quarantine is not configured");
  const session = await getOfficeSessionContext();
  if (!session || session.identity.userId !== current.identity.userId || session.identity.aal !== "aal2") {
    throw new OfficeDocumentStudioError(403, "AAL2 Office session is required for signed-document intake");
  }

  const contextMetadata = {
    instance_id: instance.id,
    render_id: input.renderId,
    provider: input.provider.trim(),
    provider_reference: input.providerReference?.trim() || null,
    signature_method: input.signatureMethod,
    signer_reference_masked: input.signerReferenceMasked?.trim() || null,
    signed_at: signedAt.toISOString(),
    evidence: input.evidence,
  };
  const form = new FormData();
  form.set("purpose", "DOCUMENT");
  form.set("context_type", "DOCUMENT_SIGNATURE");
  form.set("context_id", instance.id);
  form.set("context_metadata", JSON.stringify(contextMetadata));
  const uploadBuffer = new ArrayBuffer(input.bytes.byteLength);
  new Uint8Array(uploadBuffer).set(input.bytes);
  form.set("file", new Blob([uploadBuffer], { type: "application/pdf" }), `${instance.document_code}-signed.pdf`);

  let response: Response;
  try {
    response = await fetch(new URL("/api/v1/files/upload", runtimeOrigin), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.session.access_token}`,
        "X-Kravia-Gateway": "document-signature-intake",
      },
      body: form,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new OfficeDocumentStudioError(502, "Private signed-document quarantine is unavailable");
  }
  if (response.status >= 300 && response.status < 400) {
    throw new OfficeDocumentStudioError(502, "Unexpected signed-document quarantine redirect");
  }
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new OfficeDocumentStudioError(
      response.status,
      typeof payload.detail === "string" ? payload.detail : "Signed document could not enter private quarantine",
    );
  }
  if (payload.status !== "QUARANTINED" || typeof payload.file_id !== "string") {
    throw new OfficeDocumentStudioError(502, "Signed document quarantine returned an invalid acceptance state");
  }
  return {
    file_id: payload.file_id,
    status: "QUARANTINED",
    sha256: payload.sha256,
    byte_size: payload.byte_size,
    scan_required: true,
    finalization: "AUTOMATIC_AFTER_CLEAN_SCAN",
  };
}

export async function downloadOfficeSignedDocument(signatureId: string) {
  const current = await actor();
  const signatureResult = await current.admin
    .from("office_document_signature_evidence")
    .select("id,document_instance_id,signed_storage_reference,signed_sha256,byte_size,status")
    .eq("id", signatureId)
    .maybeSingle();
  if (signatureResult.error || !signatureResult.data) throw new OfficeDocumentStudioError(404, "Signed document evidence not found");

  const instanceResult = await current.admin
    .from("office_document_instances")
    .select("document_code,title,created_by,owner_user_id,classification,template_id")
    .eq("id", signatureResult.data.document_instance_id)
    .maybeSingle();
  if (instanceResult.error || !instanceResult.data) throw new OfficeDocumentStudioError(404, "Document instance not found");
  await requireInstanceAuthority(current,"document.instance.read",instanceResult.data);

  const download = await current.admin.storage.from("office-documents").download(signatureResult.data.signed_storage_reference);
  if (download.error || !download.data) throw new OfficeDocumentStudioError(503, "Signed document is temporarily unavailable");
  const bytes = Buffer.from(await download.data.arrayBuffer());
  if (bytes.length !== signatureResult.data.byte_size) throw new OfficeDocumentStudioError(500, "Signed document size verification failed");
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== signatureResult.data.signed_sha256) throw new OfficeDocumentStudioError(500, "Signed document integrity check failed");
  return {
    bytes,
    mime_type: "application/pdf",
    filename: `${instanceResult.data.document_code}-signed.pdf`,
    sha256: digest,
  };
}

export async function reviewOfficeSigningIssuance(input: {
  deliveryEventId: string;
  mode: "REVIEW" | "REVOKE";
  approved?: boolean;
  evidenceReference?: string;
  reason: string;
}) {
  const current = await actor();
  if (!current.identity.roles.includes("OWNER")) {
    throw new OfficeDocumentStudioError(403, "Independent Owner verification required");
  }
  const procedure = input.mode === "REVOKE"
    ? "office_signing_issuance_revoke" : "office_signing_issuance_review";
  const parameters = input.mode === "REVOKE"
    ? {
        p_actor: current.identity.userId,
        p_delivery: input.deliveryEventId,
        p_reason: input.reason,
      }
    : {
        p_actor: current.identity.userId,
        p_delivery: input.deliveryEventId,
        p_approve: input.approved === true,
        p_evidence: input.evidenceReference,
        p_reason: input.reason,
      };
  const result = await current.admin.rpc(procedure, parameters);
  if (result.error || result.data !== true) {
    throw new OfficeDocumentStudioError(409, "Independent provider evidence or reviewer authority was not verified");
  }
  return { saved: true };
}

export async function recordOfficeDocumentDelivery(input: {
  instanceId: string;
  renderId: string;
  channel: "EMAIL" | "SMS" | "SECURE_LINK" | "IN_APP" | "ESIGN" | "OTHER";
  destinationMasked?: string;
  providerReference?: string;
  eventType: string;
  metadata: Record<string, unknown>;
}) {
  const current = await actor();
  const instanceResult = await current.admin
    .from("office_document_instances")
    .select("id,owner_user_id,status,template_id")
    .eq("id", input.instanceId)
    .maybeSingle();
  if (instanceResult.error || !instanceResult.data) throw new OfficeDocumentStudioError(404, "Document instance not found");
  await requireInstanceAuthority(current,"document.delivery.record",instanceResult.data);
  const { data, error } = await current.admin.rpc("office_document_record_delivery", {
    p_actor: current.identity.userId,
    p_instance: input.instanceId,
    p_render: input.renderId,
    p_channel: input.channel,
    p_destination_masked: input.destinationMasked?.trim() || null,
    p_provider_reference: input.providerReference?.trim() || null,
    p_event_type: input.eventType.trim().toUpperCase(),
    p_metadata: input.metadata,
  });
  if (error || typeof data !== "string") throw new OfficeDocumentStudioError(400, error?.message ?? "Document delivery evidence could not be recorded");
  return { delivery_event_id: data };
}

export async function downloadOfficeDocumentRender(renderId: string) {
  const current = await actor();
  const renderResult = await current.admin.from("office_document_renders").select("id,document_instance_id,output_format,mime_type,storage_reference,sha256,byte_size,status").eq("id", renderId).maybeSingle();
  if (renderResult.error || !renderResult.data) throw new OfficeDocumentStudioError(404, "Document output not found");
  const instanceResult = await current.admin.from("office_document_instances").select("document_code,title,created_by,owner_user_id,classification,template_id").eq("id", renderResult.data.document_instance_id).maybeSingle();
  if (instanceResult.error || !instanceResult.data) throw new OfficeDocumentStudioError(404, "Document instance not found");
  await requireInstanceAuthority(current,"document.instance.read",instanceResult.data);
  const download = await current.admin.storage.from("office-documents").download(renderResult.data.storage_reference);
  if (download.error || !download.data) throw new OfficeDocumentStudioError(503, "Document output is unavailable from the private vault");
  const bytes = Buffer.from(await download.data.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== renderResult.data.sha256) throw new OfficeDocumentStudioError(500, "Stored document integrity check failed");
  const extension = ({ PDF: "pdf", DOCX: "docx", HTML: "html", XLSX: "xlsx" } as Record<string, string>)[renderResult.data.output_format] ?? "bin";
  return { bytes, mime_type: renderResult.data.mime_type, filename: `${instanceResult.data.document_code}.${extension}`, sha256: digest };
}
