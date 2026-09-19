import "server-only";

import { readOfficeRuntimeResult } from "@/lib/office/runtime-read-server";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";

export class OfficeEngineeringError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeEngineeringError";
  }
}

type ServiceRow = {
  id: string;
  service_code: string;
  product_id: string | null;
  name: string;
  project_key: string;
  repository_key: string | null;
  repository_provider: string | null;
  runtime_provider: string | null;
  runtime_service_key: string | null;
  environment: string;
  public_url: string | null;
  owner_team: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ServiceAccess = {
  service: ServiceRow;
  projectRead: OfficePermissionDecision;
  repositoryRead?: OfficePermissionDecision;
  canManageIssues: boolean;
  canChangeInfrastructure: boolean;
  canRequestProduction: boolean;
};

type RegisterServiceInput = {
  productId?: string;
  name: string;
  projectKey: string;
  repositoryKey?: string;
  repositoryProvider?: string;
  runtimeProvider?: string;
  runtimeServiceKey?: string;
  environment: "DEVELOPMENT" | "PREVIEW" | "STAGING" | "PRODUCTION";
  publicUrl?: string;
  ownerTeam?: string;
};

async function actor() {
  try {
    return await requireOfficeActor();
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeEngineeringError(error.status, error.message);
    throw error;
  }
}

async function decision(
  admin: Awaited<ReturnType<typeof requireOfficeActor>>["admin"],
  identity: Awaited<ReturnType<typeof requireOfficeActor>>["identity"],
  permissionCode: string,
  resource: OfficeResourceScope,
) {
  return resolveOfficePermission(admin, identity, permissionCode, resource);
}

async function accessForService(
  admin: Awaited<ReturnType<typeof requireOfficeActor>>["admin"],
  identity: Awaited<ReturnType<typeof requireOfficeActor>>["identity"],
  service: ServiceRow,
): Promise<ServiceAccess> {
  const project = { type: "PROJECT" as const, key: service.project_key };
  const repository = service.repository_key ? { type: "REPOSITORY" as const, key: service.repository_key } : null;
  const projectRead = await decision(admin, identity, "engineering.infrastructure.read", project);
  const repositoryRead = repository ? await decision(admin, identity, "engineering.repo.read", repository) : undefined;
  const [issue, infrastructure, production] = await Promise.all([
    decision(admin, identity, "engineering.issue.manage", project),
    decision(admin, identity, "engineering.infrastructure.change", project),
    decision(admin, identity, "engineering.deploy.production.request", project),
  ]);
  return {
    service,
    projectRead,
    repositoryRead,
    canManageIssues: issue.allowed,
    canChangeInfrastructure: infrastructure.allowed,
    canRequestProduction: production.allowed,
  };
}

function visible(access: ServiceAccess) {
  return access.projectRead.allowed || access.repositoryRead?.allowed === true;
}

function serviceProjection(access: ServiceAccess) {
  const runtimeVisible = access.projectRead.allowed;
  return {
    id: access.service.id,
    service_code: access.service.service_code,
    product_id: access.service.product_id,
    name: access.service.name,
    project_key: access.service.project_key,
    repository_key: access.service.repository_key,
    repository_provider: access.service.repository_provider,
    environment: access.service.environment,
    owner_team: access.service.owner_team,
    status: access.service.status,
    created_at: access.service.created_at,
    updated_at: access.service.updated_at,
    runtime_provider: runtimeVisible ? access.service.runtime_provider : null,
    runtime_service_key: runtimeVisible ? access.service.runtime_service_key : null,
    public_url: runtimeVisible ? access.service.public_url : null,
    runtime_redacted: !runtimeVisible,
    permissions: {
      issue_manage: access.canManageIssues,
      infrastructure_change: access.canChangeInfrastructure,
      production_request: access.canRequestProduction,
    },
  };
}

export async function getOfficeEngineeringControlCenter() {
  const { admin, identity } = await actor();
  const { data: serviceData, error: serviceError } = await admin
    .from("office_engineering_services")
    .select("id,service_code,product_id,name,project_key,repository_key,repository_provider,runtime_provider,runtime_service_key,environment,public_url,owner_team,status,created_at,updated_at")
    .neq("status", "RETIRED")
    .order("project_key", { ascending: true })
    .order("name", { ascending: true })
    .limit(200);
  if (serviceError) throw new OfficeEngineeringError(503, "Engineering service registry is temporarily unavailable");

  const access = await Promise.all(((serviceData ?? []) as ServiceRow[]).map((service) => accessForService(admin, identity, service)));
  const allowed = access.filter(visible);
  const serviceIds = allowed.map((item) => item.service.id);

  const [deploymentsResult, incidentsResult, peopleResult, productsResult] = await Promise.all([
    serviceIds.length
      ? admin.from("office_engineering_deployments").select("id,service_id,provider,provider_deployment_id,git_sha,git_ref,environment,status,source,initiated_by,deployment_url,started_at,finished_at,created_at").in("service_id", serviceIds).order("created_at", { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length
      ? admin.from("office_engineering_incidents").select("id,incident_code,service_id,severity,title,summary,status,owner_user_id,started_at,resolved_at,created_by,created_at,updated_at").in("service_id", serviceIds).order("started_at", { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status", "ACTIVE").order("display_name", { ascending: true }),
    readOfficeRuntimeResult<Array<Record<string,unknown>>>("products").then((result)=>({
      ...result,
      data:(result.data??[]).slice(0,200).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""))),
    })),
  ]);
  if (deploymentsResult.error || incidentsResult.error || peopleResult.error || productsResult.error) {
    throw new OfficeEngineeringError(503, "Engineering control data is temporarily unavailable");
  }

  const incidentIds = (incidentsResult.data ?? []).map((row) => row.id as string);
  const { data: incidentEvents, error: eventError } = incidentIds.length
    ? await admin.from("office_engineering_incident_events").select("id,incident_id,actor_user_id,action,previous_status,new_status,note,created_at").in("incident_id", incidentIds).order("created_at", { ascending: false }).limit(600)
    : { data: [], error: null };
  if (eventError) throw new OfficeEngineeringError(503, "Incident history is temporarily unavailable");

  const accessByService = new Map(allowed.map((item) => [item.service.id, item]));
  const deployments = (deploymentsResult.data ?? []).filter((row) => accessByService.get(row.service_id as string)?.projectRead.allowed);
  const incidents = (incidentsResult.data ?? []).map((row) => ({
    ...row,
    can_manage: accessByService.get(row.service_id as string)?.canManageIssues ?? false,
  }));

  const createCandidates = new Set<string>();
  for (const item of allowed) if (item.canChangeInfrastructure) createCandidates.add(item.service.project_key);
  const owner = identity.roles.includes("OWNER");

  return {
    actor: { user_id: identity.userId, roles: identity.roles, department: identity.department ?? null },
    can_register_service: owner || createCandidates.size > 0,
    managed_projects: Array.from(createCandidates).sort(),
    services: allowed.map(serviceProjection),
    deployments,
    incidents,
    incident_events: incidentEvents ?? [],
    people: peopleResult.data ?? [],
    products: productsResult.data ?? [],
  };
}

export async function registerOfficeEngineeringService(input: RegisterServiceInput) {
  const { admin, identity } = await actor();
  const resource = { type: "PROJECT" as const, key: input.projectKey };
  const permission = await decision(admin, identity, "engineering.infrastructure.change", resource);
  if (!permission.allowed) throw new OfficeEngineeringError(403, permission.reason);

  if (input.productId) {
    const products = await readOfficeRuntimeResult<Array<{id:string}>>("products");
    if (products.error || !(products.data??[]).some((product)=>product.id===input.productId)) throw new OfficeEngineeringError(400, "Canonical product not found");
  }

  const { data, error } = await admin.rpc("office_engineering_register_service", {
    p_actor: identity.userId,
    p_product: input.productId ?? null,
    p_name: input.name,
    p_project: input.projectKey,
    p_repository: input.repositoryKey?.trim() || null,
    p_repository_provider: input.repositoryProvider?.trim() || null,
    p_runtime_provider: input.runtimeProvider?.trim() || null,
    p_runtime_service: input.runtimeServiceKey?.trim() || null,
    p_environment: input.environment,
    p_public_url: input.publicUrl?.trim() || null,
    p_owner_team: input.ownerTeam?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeEngineeringError(400, error?.message ?? "Unable to register engineering service");
  return { service_id: data };
}

async function serviceForMutation(serviceId: string, permissionCode: string) {
  const { admin, identity } = await actor();
  const { data: service, error } = await admin.from("office_engineering_services").select("id,project_key,status").eq("id", serviceId).maybeSingle();
  if (error || !service || service.status === "RETIRED") throw new OfficeEngineeringError(404, "Engineering service not found");
  const permission = await decision(admin, identity, permissionCode, { type: "PROJECT", key: service.project_key as string });
  if (!permission.allowed) throw new OfficeEngineeringError(403, permission.reason);
  return { admin, identity, service };
}

export async function createOfficeEngineeringIncident(input: { serviceId: string; severity: "SEV1" | "SEV2" | "SEV3" | "SEV4"; title: string; summary?: string; ownerUserId?: string }) {
  const { admin, identity } = await serviceForMutation(input.serviceId, "engineering.issue.manage");
  if (input.ownerUserId) {
    const { data: owner, error } = await admin.from("office_identity_users").select("user_id").eq("user_id", input.ownerUserId).eq("status", "ACTIVE").maybeSingle();
    if (error || !owner) throw new OfficeEngineeringError(400, "Incident owner is not an active Office identity");
  }
  const { data, error } = await admin.rpc("office_engineering_create_incident", {
    p_actor: identity.userId,
    p_service: input.serviceId,
    p_severity: input.severity,
    p_title: input.title,
    p_summary: input.summary ?? "",
    p_owner: input.ownerUserId ?? identity.userId,
  });
  if (error || typeof data !== "string") throw new OfficeEngineeringError(400, error?.message ?? "Unable to create incident");
  return { incident_id: data };
}

export async function transitionOfficeEngineeringIncident(input: { incidentId: string; action: "MITIGATE" | "MONITOR" | "RESOLVE" | "REOPEN"; note?: string }) {
  const { admin, identity } = await actor();
  const { data: incident, error: incidentError } = await admin.from("office_engineering_incidents").select("id,service_id").eq("id", input.incidentId).maybeSingle();
  if (incidentError || !incident) throw new OfficeEngineeringError(404, "Incident not found");
  const { data: service, error: serviceError } = await admin.from("office_engineering_services").select("project_key,status").eq("id", incident.service_id).maybeSingle();
  if (serviceError || !service || service.status === "RETIRED") throw new OfficeEngineeringError(404, "Engineering service not found");
  const permission = await decision(admin, identity, "engineering.issue.manage", { type: "PROJECT", key: service.project_key as string });
  if (!permission.allowed) throw new OfficeEngineeringError(403, permission.reason);
  const { data, error } = await admin.rpc("office_engineering_transition_incident", {
    p_actor: identity.userId,
    p_incident: input.incidentId,
    p_action: input.action,
    p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeEngineeringError(400, error?.message ?? "Unable to update incident");
  return { status: data };
}
