import "server-only";

import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";

export class OfficeCapabilityError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeCapabilityError";
  }
}

export type OfficeCapabilityScope = {
  permission: string;
  source: "OWNER" | "PROFILE" | "OVERRIDE_ALLOW";
  scope_type: string;
  scope_key: string | null;
  profile_code?: string;
};

export type OfficeCapabilitySnapshot = {
  generated_at: string;
  permissions: string[];
  scopes: OfficeCapabilityScope[];
};

function active(expiresAt: unknown, now = Date.now()) {
  if (typeof expiresAt !== "string" || !expiresAt) return true;
  const parsed = Date.parse(expiresAt);
  return Number.isFinite(parsed) && parsed > now;
}

export async function getOfficeCapabilitySnapshot(): Promise<OfficeCapabilitySnapshot> {
  let actor: Awaited<ReturnType<typeof requireOfficeActor>>;
  try {
    actor = await requireOfficeActor();
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeCapabilityError(error.status, error.message);
    throw error;
  }

  const { admin, identity } = actor;
  const catalog = await admin
    .from("office_permission_catalog")
    .select("code,active")
    .eq("active", true)
    .order("code", { ascending: true });
  if (catalog.error) throw new OfficeCapabilityError(503, "Authorization catalog is temporarily unavailable");
  const activeCodes = new Set((catalog.data ?? []).map((row) => String(row.code)));

  if (identity.roles.includes("OWNER")) {
    const permissions = Array.from(activeCodes).sort();
    return {
      generated_at: new Date().toISOString(),
      permissions,
      scopes: permissions.map((permission) => ({ permission, source: "OWNER" as const, scope_type: "COMPANY", scope_key: null })),
    };
  }

  const [profilesResult, overridesResult] = await Promise.all([
    admin
      .from("office_user_access_profiles")
      .select("profile_code,scope_type,scope_key,status,expires_at")
      .eq("user_id", identity.userId)
      .eq("status", "ACTIVE"),
    admin
      .from("office_user_permission_overrides")
      .select("permission_code,effect,scope_type,scope_key,expires_at")
      .eq("user_id", identity.userId),
  ]);
  if (profilesResult.error || overridesResult.error) throw new OfficeCapabilityError(503, "Authorization assignments are temporarily unavailable");

  const profiles = (profilesResult.data ?? []).filter((row) => active(row.expires_at));
  const profileCodes = Array.from(new Set(profiles.map((row) => String(row.profile_code))));
  const mappingsResult = profileCodes.length
    ? await admin
        .from("office_access_profile_permissions")
        .select("profile_code,permission_code,effect,default_scope_type")
        .in("profile_code", profileCodes)
    : { data: [], error: null };
  if (mappingsResult.error) throw new OfficeCapabilityError(503, "Authorization profile map is temporarily unavailable");

  const scopes: OfficeCapabilityScope[] = [];
  const globallyDenied = new Set<string>();
  for (const override of overridesResult.data ?? []) {
    if (!active(override.expires_at)) continue;
    const permission = String(override.permission_code);
    if (!activeCodes.has(permission)) continue;
    const scopeType = String(override.scope_type || "COMPANY");
    if (override.effect === "DENY" && scopeType === "COMPANY") globallyDenied.add(permission);
    if (override.effect === "ALLOW") {
      scopes.push({
        permission,
        source: "OVERRIDE_ALLOW",
        scope_type: scopeType,
        scope_key: override.scope_key ? String(override.scope_key) : null,
      });
    }
  }

  for (const mapping of mappingsResult.data ?? []) {
    if (mapping.effect !== "ALLOW") continue;
    const permission = String(mapping.permission_code);
    if (!activeCodes.has(permission)) continue;
    for (const assignment of profiles.filter((row) => row.profile_code === mapping.profile_code)) {
      scopes.push({
        permission,
        source: "PROFILE",
        profile_code: String(mapping.profile_code),
        scope_type: String(assignment.scope_type || mapping.default_scope_type || "COMPANY"),
        scope_key: assignment.scope_key ? String(assignment.scope_key) : null,
      });
    }
  }

  const permissions = Array.from(new Set(scopes.map((scope) => scope.permission).filter((code) => !globallyDenied.has(code)))).sort();
  return {
    generated_at: new Date().toISOString(),
    permissions,
    scopes: scopes.filter((scope) => permissions.includes(scope.permission)),
  };
}
