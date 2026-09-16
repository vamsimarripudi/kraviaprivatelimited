import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireOfficeAdminEnvironment } from "@/lib/env/office";
import { getOfficeSessionContext, officeIdentityIsProvisioned, type OfficeIdentity } from "@/lib/office/auth-server";

export const officeScopeTypes = ["COMPANY","DEPARTMENT","TEAM","PRODUCT","PROJECT","REPOSITORY","COST_CENTER","OWN"] as const;
export type OfficeScopeType = (typeof officeScopeTypes)[number];

export type OfficeResourceScope = {
  type: OfficeScopeType;
  key?: string | null;
  ownerUserId?: string | null;
};

export type OfficePermissionDecision = {
  allowed: boolean;
  permission: string;
  source?: "OWNER" | "PROFILE" | "OVERRIDE_ALLOW" | "OVERRIDE_DENY";
  profileCode?: string;
  scopeType?: OfficeScopeType;
  scopeKey?: string | null;
  highRisk?: boolean;
  requiresManagedDevice?: boolean;
  reason: string;
};

export class OfficePermissionError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficePermissionError";
  }
}

export function createOfficeServiceClient(): SupabaseClient {
  const environment = requireOfficeAdminEnvironment();
  return createClient(environment.OFFICE_SUPABASE_URL, environment.OFFICE_SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function requireOfficeActor(): Promise<{ admin: SupabaseClient; identity: OfficeIdentity }> {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) throw new OfficePermissionError(401, "Office sign-in required");
  if (context.identity.aal !== "aal2") throw new OfficePermissionError(403, "AAL2 verification is required");
  try {
    return { admin: createOfficeServiceClient(), identity: context.identity };
  } catch {
    throw new OfficePermissionError(503, "Trusted Office authorization is not configured");
  }
}

function active(expiresAt: unknown, now = Date.now()) {
  if (typeof expiresAt !== "string" || !expiresAt) return true;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

function scopeMatches(grantType: OfficeScopeType, grantKey: string | null | undefined, resource: OfficeResourceScope, userId: string) {
  if (grantType === "COMPANY") return true;
  if (grantType === "OWN") return resource.ownerUserId === userId;
  if (grantType !== resource.type) return false;
  return !grantKey || grantKey === resource.key;
}

export async function resolveOfficePermission(
  admin: SupabaseClient,
  identity: OfficeIdentity,
  permissionCode: string,
  resource: OfficeResourceScope = { type: "COMPANY" },
  deviceId?: string | null,
): Promise<OfficePermissionDecision> {
  if (identity.roles.includes("OWNER")) {
    return { allowed: true, permission: permissionCode, source: "OWNER", scopeType: "COMPANY", reason: "OWNER authority" };
  }

  const [permissionResult, profileResult, overrideResult] = await Promise.all([
    admin.from("office_permission_catalog").select("code,high_risk,requires_managed_device,active").eq("code", permissionCode).maybeSingle(),
    admin.from("office_user_access_profiles").select("profile_code,scope_type,scope_key,status,expires_at").eq("user_id", identity.userId).eq("status", "ACTIVE"),
    admin.from("office_user_permission_overrides").select("permission_code,effect,scope_type,scope_key,expires_at").eq("user_id", identity.userId).eq("permission_code", permissionCode),
  ]);

  if (permissionResult.error || !permissionResult.data || permissionResult.data.active !== true) {
    return { allowed: false, permission: permissionCode, reason: "Permission is not active" };
  }
  if (profileResult.error || overrideResult.error) {
    return { allowed: false, permission: permissionCode, reason: "Authorization authority is unavailable" };
  }

  const deny = (overrideResult.data ?? []).find((row) => row.effect === "DENY" && active(row.expires_at) && scopeMatches(row.scope_type as OfficeScopeType, row.scope_key, resource, identity.userId));
  if (deny) return { allowed: false, permission: permissionCode, source: "OVERRIDE_DENY", scopeType: deny.scope_type as OfficeScopeType, scopeKey: deny.scope_key, reason: "Explicit permission deny" };

  const allowOverride = (overrideResult.data ?? []).find((row) => row.effect === "ALLOW" && active(row.expires_at) && scopeMatches(row.scope_type as OfficeScopeType, row.scope_key, resource, identity.userId));
  if (allowOverride) {
    return await enforceDevice(admin, identity.userId, permissionCode, permissionResult.data, {
      allowed: true, permission: permissionCode, source: "OVERRIDE_ALLOW", scopeType: allowOverride.scope_type as OfficeScopeType, scopeKey: allowOverride.scope_key, reason: "Explicit permission allow",
    }, deviceId);
  }

  const activeProfiles = (profileResult.data ?? []).filter((row) => active(row.expires_at));
  if (!activeProfiles.length) return { allowed: false, permission: permissionCode, reason: "No active access profile grants this permission" };
  const profileCodes = activeProfiles.map((row) => row.profile_code);
  const mappingResult = await admin.from("office_access_profile_permissions").select("profile_code,permission_code,effect,default_scope_type").in("profile_code", profileCodes).eq("permission_code", permissionCode).eq("effect", "ALLOW");
  if (mappingResult.error) return { allowed: false, permission: permissionCode, reason: "Authorization authority is unavailable" };

  for (const mapping of mappingResult.data ?? []) {
    const assignment = activeProfiles.find((row) => row.profile_code === mapping.profile_code);
    if (!assignment) continue;
    const grantType = (assignment.scope_type || mapping.default_scope_type) as OfficeScopeType;
    const grantKey = assignment.scope_key;
    if (!scopeMatches(grantType, grantKey, resource, identity.userId)) continue;
    return await enforceDevice(admin, identity.userId, permissionCode, permissionResult.data, {
      allowed: true, permission: permissionCode, source: "PROFILE", profileCode: mapping.profile_code, scopeType: grantType, scopeKey: grantKey, reason: `Granted by ${mapping.profile_code}`,
    }, deviceId);
  }

  return { allowed: false, permission: permissionCode, reason: "Permission is outside the user's assigned scope" };
}

async function enforceDevice(
  admin: SupabaseClient,
  userId: string,
  permissionCode: string,
  permission: { high_risk: boolean; requires_managed_device: boolean },
  decision: OfficePermissionDecision,
  deviceId?: string | null,
): Promise<OfficePermissionDecision> {
  const enforced = process.env.OFFICE_DEVICE_ENFORCEMENT?.toLowerCase() === "true";
  if (!enforced || (!permission.high_risk && !permission.requires_managed_device)) return { ...decision, highRisk: permission.high_risk, requiresManagedDevice: permission.requires_managed_device };
  if (!deviceId) return { allowed: false, permission: permissionCode, highRisk: permission.high_risk, requiresManagedDevice: true, reason: "A trusted company-managed device is required" };

  const { data, error } = await admin.from("office_device_registry").select("id,trust_state,company_managed").eq("id", deviceId).eq("user_id", userId).maybeSingle();
  if (error || !data || data.trust_state !== "TRUSTED" || data.company_managed !== true) {
    return { allowed: false, permission: permissionCode, highRisk: permission.high_risk, requiresManagedDevice: true, reason: "The current device is not trusted for this action" };
  }
  return { ...decision, highRisk: permission.high_risk, requiresManagedDevice: true };
}

export async function requireOfficePermission(
  permissionCode: string,
  resource: OfficeResourceScope = { type: "COMPANY" },
  deviceId?: string | null,
) {
  const actor = await requireOfficeActor();
  const decision = await resolveOfficePermission(actor.admin, actor.identity, permissionCode, resource, deviceId);
  if (!decision.allowed) throw new OfficePermissionError(403, decision.reason);
  return { ...actor, decision };
}
