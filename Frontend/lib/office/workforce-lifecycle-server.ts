import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";

export class OfficeWorkforceLifecycleError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeWorkforceLifecycleError";
  }
}

type LifecycleKind = "ONBOARDING" | "OFFBOARDING";
type Row = Record<string, unknown>;

async function actor() {
  try {
    return await requireOfficeActor();
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeWorkforceLifecycleError(error.status, error.message);
    throw error;
  }
}

async function permitted(
  admin: Awaited<ReturnType<typeof requireOfficeActor>>["admin"],
  identity: Awaited<ReturnType<typeof requireOfficeActor>>["identity"],
  permission: string,
  resource: OfficeResourceScope,
) {
  return (await resolveOfficePermission(admin, identity, permission, resource)).allowed;
}

async function canManagePerson(
  admin: Awaited<ReturnType<typeof requireOfficeActor>>["admin"],
  identity: Awaited<ReturnType<typeof requireOfficeActor>>["identity"],
  target: { user_id: string; primary_department?: string | null },
) {
  if (await permitted(admin, identity, "people.update", { type: "COMPANY" })) return true;
  if (target.primary_department && await permitted(admin, identity, "people.update", { type: "DEPARTMENT", key: target.primary_department })) return true;
  return permitted(admin, identity, "people.update", { type: "OWN", ownerUserId: target.user_id });
}

async function visiblePeople(
  admin: Awaited<ReturnType<typeof requireOfficeActor>>["admin"],
  identity: Awaited<ReturnType<typeof requireOfficeActor>>["identity"],
) {
  const companyRead = await permitted(admin, identity, "people.basic.read", { type: "COMPANY" });
  if (companyRead) {
    const result = await admin.from("office_identity_users").select("user_id,status,display_name,job_title,primary_department,authorization_version,created_at,updated_at").order("display_name", { ascending: true });
    if (result.error) throw new OfficeWorkforceLifecycleError(503, "Workforce lifecycle directory is temporarily unavailable");
    return result.data ?? [];
  }
  if (identity.department && await permitted(admin, identity, "people.basic.read", { type: "DEPARTMENT", key: identity.department })) {
    const result = await admin.from("office_identity_users").select("user_id,status,display_name,job_title,primary_department,authorization_version,created_at,updated_at").eq("primary_department", identity.department).order("display_name", { ascending: true });
    if (result.error) throw new OfficeWorkforceLifecycleError(503, "Workforce lifecycle directory is temporarily unavailable");
    return result.data ?? [];
  }
  if (await permitted(admin, identity, "people.basic.read", { type: "OWN", ownerUserId: identity.userId })) {
    const result = await admin.from("office_identity_users").select("user_id,status,display_name,job_title,primary_department,authorization_version,created_at,updated_at").eq("user_id", identity.userId);
    if (result.error) throw new OfficeWorkforceLifecycleError(503, "Workforce lifecycle directory is temporarily unavailable");
    return result.data ?? [];
  }
  throw new OfficeWorkforceLifecycleError(403, "People directory permission is required");
}

export async function getOfficeWorkforceLifecycle() {
  const { admin, identity } = await actor();
  const people = (await visiblePeople(admin, identity)) as Array<{ user_id: string; status: string; display_name?: string | null; job_title?: string | null; primary_department?: string | null; authorization_version: number }>;
  const ids = people.map((person) => person.user_id);
  const [jobs, requests] = await Promise.all([
    ids.length
      ? admin.from("office_job_assignments").select("user_id,position_code,department_code,reports_to_user_id,employment_type,status,start_date,end_date,updated_at").in("user_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? admin.from("office_requests").select("id,request_type_code,target_user_id,title,status,current_step_order,due_at,submitted_at,completed_at,created_at,updated_at").in("target_user_id", ids).in("request_type_code", ["EMPLOYEE_ONBOARDING", "EMPLOYEE_OFFBOARDING"]).order("created_at", { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (jobs.error || requests.error) throw new OfficeWorkforceLifecycleError(503, "Workforce lifecycle state is temporarily unavailable");

  const jobMap = new Map(((jobs.data ?? []) as Row[]).map((row) => [String(row.user_id), row]));
  const requestsByUser = new Map<string, Row[]>();
  for (const request of (requests.data ?? []) as Row[]) {
    const userId = String(request.target_user_id ?? "");
    const current = requestsByUser.get(userId) ?? [];
    current.push(request);
    requestsByUser.set(userId, current);
  }

  const enriched = await Promise.all(people.map(async (person) => ({
    ...person,
    job: jobMap.get(person.user_id) ?? null,
    lifecycle_requests: requestsByUser.get(person.user_id) ?? [],
    can_manage: await canManagePerson(admin, identity, person),
  })));

  const canExecute = identity.roles.some((role) => role === "OWNER" || role === "ADMIN")
    && await permitted(admin, identity, "access.profile.assign", { type: "COMPANY" });

  return {
    actor: { user_id: identity.userId, roles: identity.roles, department: identity.department ?? null },
    people: enriched,
    can_execute_offboarding: canExecute,
    disclaimer: "Lifecycle requests coordinate human approvals. External provider accounts are never provisioned or deleted automatically by this surface.",
  };
}

export async function createOfficeWorkforceLifecycleRequest(input: { targetUserId: string; kind: LifecycleKind; reason: string }) {
  const { admin, identity } = await actor();
  const { data: target, error: targetError } = await admin.from("office_identity_users").select("user_id,status,display_name,primary_department").eq("user_id", input.targetUserId).maybeSingle();
  if (targetError || !target) throw new OfficeWorkforceLifecycleError(404, "Workforce identity not found");
  if (!await canManagePerson(admin, identity, target)) throw new OfficeWorkforceLifecycleError(403, "People update permission is required for this identity");
  if (input.kind === "ONBOARDING" && !["INVITED", "ACTIVE"].includes(String(target.status))) throw new OfficeWorkforceLifecycleError(409, "Only invited or active identities can enter onboarding");
  if (input.kind === "OFFBOARDING" && !["ACTIVE", "SUSPENDED"].includes(String(target.status))) throw new OfficeWorkforceLifecycleError(409, "Only active or suspended identities can enter offboarding");
  if (input.kind === "OFFBOARDING" && input.targetUserId === identity.userId) throw new OfficeWorkforceLifecycleError(400, "Self-offboarding is not allowed");

  const requestType = input.kind === "ONBOARDING" ? "EMPLOYEE_ONBOARDING" : "EMPLOYEE_OFFBOARDING";
  const duplicate = await admin.from("office_requests").select("id,status").eq("target_user_id", input.targetUserId).eq("request_type_code", requestType).in("status", ["DRAFT", "PENDING", "IN_REVIEW", "APPROVED"]).limit(1).maybeSingle();
  if (duplicate.error) throw new OfficeWorkforceLifecycleError(503, "Unable to verify lifecycle request state");
  if (duplicate.data) return { request_id: duplicate.data.id, existing: true };

  const displayName = String(target.display_name || "Office member");
  const { data, error } = await admin.rpc("office_create_request", {
    p_requester: identity.userId,
    p_request_type: requestType,
    p_title: `${input.kind === "ONBOARDING" ? "Onboarding" : "Offboarding"} · ${displayName}`,
    p_description: input.reason.trim(),
    p_payload: { lifecycle_kind: input.kind, target_user_id: input.targetUserId, reason: input.reason.trim() },
    p_priority: input.kind === "OFFBOARDING" ? "HIGH" : "NORMAL",
    p_target_user: input.targetUserId,
    p_resource_type: "WORKFORCE_IDENTITY",
    p_resource_key: input.targetUserId,
  });
  if (error || typeof data !== "string") throw new OfficeWorkforceLifecycleError(400, error?.message ?? "Unable to create workforce lifecycle request");
  return { request_id: data, existing: false };
}

export async function executeOfficeWorkforceOffboarding(input: { targetUserId: string; requestId: string; reason: string }) {
  const { admin, identity } = await actor();
  if (!identity.roles.some((role) => role === "OWNER" || role === "ADMIN")) throw new OfficeWorkforceLifecycleError(403, "OWNER or ADMIN authority is required for access revocation");
  if (!await permitted(admin, identity, "access.profile.assign", { type: "COMPANY" })) throw new OfficeWorkforceLifecycleError(403, "Company access-assignment permission is required");
  const { data, error } = await admin.rpc("office_execute_workforce_offboarding", {
    p_actor: identity.userId,
    p_target: input.targetUserId,
    p_request: input.requestId,
    p_reason: input.reason.trim(),
  });
  if (error || data !== true) throw new OfficeWorkforceLifecycleError(400, error?.message ?? "Unable to execute approved offboarding");
  return { revoked: true, request_id: input.requestId, target_user_id: input.targetUserId };
}
