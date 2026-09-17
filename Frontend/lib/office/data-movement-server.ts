import "server-only";

import { OfficePermissionError, requireOfficeActor, resolveOfficePermission, type OfficeResourceScope, type OfficeScopeType } from "@/lib/office/permission-engine";
import { getOfficeWorkOverview } from "@/lib/office/workflow-server";

export class OfficeDataMovementError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeDataMovementError";
  }
}

type MovementKind = "EXPORT" | "IMPORT";
const scopedTypes = ["COMPANY","DEPARTMENT","TEAM","PRODUCT","PROJECT","REPOSITORY","COST_CENTER","OWN"] as const;
type ScopedType = (typeof scopedTypes)[number];

async function actor() {
  try { return await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeDataMovementError(error.status, error.message);
    throw error;
  }
}

function resource(identity: Awaited<ReturnType<typeof requireOfficeActor>>["identity"], scopeType: ScopedType, scopeKey?: string): OfficeResourceScope {
  if (scopeType === "OWN") return { type: "OWN", ownerUserId: identity.userId };
  if (scopeType === "COMPANY") return { type: "COMPANY" };
  return { type: scopeType as OfficeScopeType, key: scopeKey ?? null };
}

async function requireMovementPermission(kind: MovementKind, scopeType: ScopedType, scopeKey?: string) {
  const current = await actor();
  const permission = kind === "EXPORT" ? "data.export.request" : "data.import.request";
  const decision = await resolveOfficePermission(current.admin, current.identity, permission, resource(current.identity, scopeType, scopeKey));
  if (!decision.allowed) throw new OfficeDataMovementError(403, decision.reason);
  return { ...current, decision };
}

async function scopeOptions(kind: MovementKind) {
  const current = await actor();
  if (current.identity.roles.includes("OWNER")) return [{ type: "COMPANY", key: null, label: "Company" }];
  const permission = kind === "EXPORT" ? "data.export.request" : "data.import.request";
  const { data: assignments, error: assignmentError } = await current.admin.from("office_user_access_profiles").select("profile_code,scope_type,scope_key,status,expires_at").eq("user_id", current.identity.userId).eq("status", "ACTIVE");
  if (assignmentError) throw new OfficeDataMovementError(503, "Unable to resolve data-movement scope");
  const active = (assignments ?? []).filter((row) => !row.expires_at || Date.parse(String(row.expires_at)) > Date.now());
  if (!active.length) return [];
  const profiles = Array.from(new Set(active.map((row) => String(row.profile_code))));
  const { data: mappings, error: mappingError } = await current.admin.from("office_access_profile_permissions").select("profile_code,permission_code,effect,default_scope_type").in("profile_code", profiles).eq("permission_code", permission).eq("effect", "ALLOW");
  if (mappingError) throw new OfficeDataMovementError(503, "Unable to resolve data-movement capability");
  const options: Array<{ type: string; key: string | null; label: string }> = [];
  for (const mapping of mappings ?? []) {
    const assignment = active.find((row) => row.profile_code === mapping.profile_code);
    if (!assignment) continue;
    const type = String(assignment.scope_type || mapping.default_scope_type);
    const key = assignment.scope_key ? String(assignment.scope_key) : null;
    if (type === "OWN") options.push({ type, key: current.identity.userId, label: "My records" });
    else if (type === "DEPARTMENT") options.push({ type, key: key || current.identity.department || null, label: `Department${key || current.identity.department ? ` · ${key || current.identity.department}` : ""}` });
    else options.push({ type, key, label: key ? `${type} · ${key}` : type });
  }
  return options.filter((item, index, list) => list.findIndex((candidate) => candidate.type === item.type && candidate.key === item.key) === index);
}

export async function getOfficeDataMovement() {
  const work = await getOfficeWorkOverview();
  const [exportScopes, importScopes] = await Promise.all([scopeOptions("EXPORT"), scopeOptions("IMPORT")]);
  const requestTypes = new Set(["DATA_EXPORT", "DATA_IMPORT"]);
  return {
    actor: work.identity,
    export_scopes: exportScopes,
    import_scopes: importScopes,
    requests: (work.requests ?? []).filter((request) => requestTypes.has(String(request.request_type_code))),
    approvals: (work.approvals ?? []).filter((entry) => requestTypes.has(String((entry.request as { request_type_code?: unknown } | null)?.request_type_code ?? ""))),
    disclaimer: "This surface creates and tracks approval records only. It does not release exports, ingest files or mutate canonical records automatically.",
  };
}

export async function createOfficeDataMovementRequest(input: {
  kind: MovementKind;
  scopeType: ScopedType;
  scopeKey?: string;
  title: string;
  description: string;
  purpose: string;
  classification: "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  format?: "CSV" | "JSON" | "PDF" | "OTHER";
  sourceReference?: string;
}) {
  if (!scopedTypes.includes(input.scopeType)) throw new OfficeDataMovementError(400, "Invalid data scope");
  if (!input.scopeKey && !["COMPANY", "OWN"].includes(input.scopeType)) throw new OfficeDataMovementError(400, "Scoped data movement requires a resource key");
  const current = await requireMovementPermission(input.kind, input.scopeType, input.scopeKey);
  const requestType = input.kind === "EXPORT" ? "DATA_EXPORT" : "DATA_IMPORT";
  const { data, error } = await current.admin.rpc("office_create_request", {
    p_requester: current.identity.userId,
    p_request_type: requestType,
    p_title: input.title,
    p_description: input.description,
    p_payload: {
      movement_kind: input.kind,
      purpose: input.purpose,
      classification: input.classification,
      requested_format: input.format ?? null,
      source_reference: input.sourceReference?.trim() || null,
      requested_scope: { type: input.scopeType, key: input.scopeKey ?? null },
      automatic_execution: false,
    },
    p_priority: input.classification === "RESTRICTED" ? "HIGH" : "NORMAL",
    p_target_user: null,
    p_resource_type: input.scopeType,
    p_resource_key: input.scopeType === "OWN" ? current.identity.userId : input.scopeKey ?? null,
  });
  if (error || typeof data !== "string") throw new OfficeDataMovementError(400, error?.message ?? "Unable to create data-movement request");
  return { request_id: data };
}
