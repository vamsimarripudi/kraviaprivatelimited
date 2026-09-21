import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireOfficeAdminEnvironment } from "@/lib/env/office";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import { activeRoleNames, canAdministerAccess, canManageTarget, type OfficeDepartment } from "@/lib/office/access-policy";
import type { OfficeRole } from "@/lib/office/workspaces";

export class WorkforceAdminError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "WorkforceAdminError";
  }
}

type Actor = { userId: string; email?: string; roles: OfficeRole[] };
type Authority = { admin: SupabaseClient; actor: Actor };

type Target = { userId: string; status: string; email?: string; roles: OfficeRole[] };
type DirectoryUser = { id: string; email?: string | null; last_sign_in_at?: string | null };

function client() {
  const env = requireOfficeAdminEnvironment();
  return createClient(env.OFFICE_SUPABASE_URL, env.OFFICE_SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function authority(): Promise<Authority> {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) throw new WorkforceAdminError(401, "Office sign-in required");
  if (context.identity.aal !== "aal2") throw new WorkforceAdminError(403, "AAL2 verification is required");
  if (!canAdministerAccess(context.identity.roles)) throw new WorkforceAdminError(403, "OWNER or ADMIN authority is required");
  try {
    return { admin: client(), actor: { userId: context.identity.userId, email: context.identity.email, roles: context.identity.roles } };
  } catch {
    throw new WorkforceAdminError(503, "Trusted workforce administration is not configured");
  }
}

function fail(error: { message?: string } | null, message: string) {
  if (error) throw new WorkforceAdminError(500, message);
}

async function listAllUsers(admin: SupabaseClient): Promise<DirectoryUser[]> {
  const { data, error } = await admin
    .from("office_auth_users")
    .select("id,email,last_login_at")
    .order("created_at", { ascending: true })
    .limit(5000);
  fail(error, "Unable to read workforce directory");
  return (data ?? []).map((user) => ({
    id: user.id,
    email: user.email,
    last_sign_in_at: user.last_login_at,
  }));
}

async function target(admin: SupabaseClient, userId: string): Promise<Target> {
  const [identityResult, rolesResult, authResult] = await Promise.all([
    admin.from("office_identity_users").select("status").eq("user_id", userId).maybeSingle(),
    admin.from("office_user_roles").select("role,expires_at").eq("user_id", userId),
    admin.from("office_auth_users").select("id,email").eq("id", userId).maybeSingle(),
  ]);
  if (identityResult.error || rolesResult.error || authResult.error || !identityResult.data || !authResult.data) {
    throw new WorkforceAdminError(404, "Workforce identity not found");
  }
  return {
    userId,
    status: String(identityResult.data.status),
    email: authResult.data.email ?? undefined,
    roles: activeRoleNames((rolesResult.data ?? []) as { role: unknown; expires_at?: unknown }[]),
  };
}

async function requireManagedTarget(admin: SupabaseClient, actor: Actor, userId: string) {
  const current = await target(admin, userId);
  if (current.status === "REVOKED") throw new WorkforceAdminError(409, "Revoked identities cannot be modified");
  const decision = canManageTarget(actor.userId, actor.roles, current.userId, current.roles);
  if (!decision.allowed) throw new WorkforceAdminError(403, decision.reason);
  return current;
}

export async function getWorkforceAdministrationState() {
  const { admin, actor } = await authority();
  const nowMs = Date.now();
  const [authUsers, identities, roles, jobs, positions, profiles, profilePermissions, permissions, userProfiles, overrides, devices, departments] = await Promise.all([
    listAllUsers(admin),
    admin.from("office_identity_users").select("user_id,status,display_name,job_title,primary_department,authorization_version,access_review_due_at,created_at").order("created_at", { ascending: true }),
    admin.from("office_user_roles").select("user_id,role,expires_at").order("created_at", { ascending: true }),
    admin.from("office_job_assignments").select("user_id,position_code,department_code,reports_to_user_id,team_key,product_key,employment_type,status,started_at,ended_at,updated_at"),
    admin.from("office_position_catalog").select("code,label,family,level,is_manager,description,active").eq("active", true).order("level", { ascending: false }).order("label", { ascending: true }),
    admin.from("office_access_profile_catalog").select("code,label,category,description,max_active_devices,requires_managed_device_for_high_risk,assignable_by_admin,owner_managed_only,active").eq("active", true).order("label", { ascending: true }),
    admin.from("office_access_profile_permissions").select("profile_code,permission_code,effect,default_scope_type"),
    admin.from("office_permission_catalog").select("code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active").eq("active", true).order("module", { ascending: true }).order("label", { ascending: true }),
    admin.from("office_user_access_profiles").select("id,user_id,profile_code,scope_type,scope_key,status,granted_by,grant_reason,expires_at,created_at,updated_at").order("created_at", { ascending: true }),
    admin.from("office_user_permission_overrides").select("*").order("created_at", { ascending: false }),
    admin.from("office_device_registry").select("id,user_id,device_label,device_kind,platform,trust_state,company_managed,approved_by,approved_at,revoked_at,last_seen_at,created_at").order("created_at", { ascending: false }),
    admin.from("office_department_catalog").select("code,label,description,active").eq("active", true).order("label", { ascending: true }),
  ]);

  for (const [result, message] of [
    [identities, "Unable to read workforce identities"], [roles, "Unable to read workforce roles"], [jobs, "Unable to read job assignments"],
    [positions, "Unable to read position catalog"], [profiles, "Unable to read access-profile catalog"], [profilePermissions, "Unable to read profile permissions"],
    [permissions, "Unable to read permission catalog"], [userProfiles, "Unable to read profile assignments"], [overrides, "Unable to read permission overrides"],
    [devices, "Unable to read device registry"], [departments, "Unable to read department catalog"],
  ] as const) fail(result.error, message);

  const authMap = new Map(authUsers.map((user) => [user.id, user]));
  const rolesByUser = new Map<string, Array<{ role: unknown; expires_at?: unknown }>>();
  for (const role of roles.data ?? []) {
    const current = rolesByUser.get(role.user_id) ?? [];
    current.push(role);
    rolesByUser.set(role.user_id, current);
  }
  const jobMap = new Map((jobs.data ?? []).map((row) => [row.user_id, row]));
  const profilesByUser = new Map<string, Array<Record<string, unknown>>>();
  for (const profile of (userProfiles.data ?? []) as Array<Record<string, unknown>>) {
    const userId = String(profile.user_id ?? "");
    const current = profilesByUser.get(userId) ?? [];
    const expiresAt = typeof profile.expires_at === "string" ? profile.expires_at : null;
    const expiryMs = expiresAt ? Date.parse(expiresAt) : Number.POSITIVE_INFINITY;
    current.push({ ...profile, active: profile.status === "ACTIVE" && (!expiresAt || (Number.isFinite(expiryMs) && expiryMs > nowMs)) });
    profilesByUser.set(userId, current);
  }
  const devicesByUser = new Map<string, Array<Record<string, unknown>>>();
  for (const device of (devices.data ?? []) as Array<Record<string, unknown>>) {
    const userId = String(device.user_id ?? "");
    const current = devicesByUser.get(userId) ?? [];
    current.push(device);
    devicesByUser.set(userId, current);
  }
  const overridesByUser = new Map<string, Array<Record<string, unknown>>>();
  for (const override of (overrides.data ?? []) as Array<Record<string, unknown>>) {
    const userId = String(override.user_id ?? "");
    const current = overridesByUser.get(userId) ?? [];
    current.push(override);
    overridesByUser.set(userId, current);
  }

  const people = ((identities.data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const userId = String(row.user_id ?? "");
    const authUser = authMap.get(userId);
    return {
      user_id: userId,
      email: authUser?.email ?? null,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
      status: row.status,
      display_name: row.display_name,
      job_title: row.job_title,
      primary_department: row.primary_department,
      authorization_version: row.authorization_version,
      access_review_due_at: row.access_review_due_at,
      roles: activeRoleNames(rolesByUser.get(userId) ?? []),
      job: jobMap.get(userId) ?? null,
      access_profiles: profilesByUser.get(userId) ?? [],
      permission_overrides: overridesByUser.get(userId) ?? [],
      devices: devicesByUser.get(userId) ?? [],
    };
  });

  return {
    actor,
    people,
    positions: positions.data ?? [],
    access_profiles: profiles.data ?? [],
    profile_permissions: profilePermissions.data ?? [],
    permissions: permissions.data ?? [],
    departments: departments.data ?? [],
    devices: devices.data ?? [],
  };
}

export async function assignWorkforceJob(input: { targetUserId: string; position: string; department: OfficeDepartment; reportsTo?: string; teamKey?: string; productKey?: string; employmentType: string; reason: string }) {
  const { admin, actor } = await authority();
  await requireManagedTarget(admin, actor, input.targetUserId);
  const { data: position, error: positionError } = await admin.from("office_position_catalog").select("code,family,level").eq("code", input.position).eq("active", true).maybeSingle();
  if (positionError || !position) throw new WorkforceAdminError(400, "Invalid position");
  if (!actor.roles.includes("OWNER") && (position.family === "EXECUTIVE" || Number(position.level) >= 8)) {
    throw new WorkforceAdminError(403, "Executive and department-head appointments require OWNER authority");
  }
  const { data, error } = await admin.rpc("office_assign_job", {
    p_actor: actor.userId,
    p_target: input.targetUserId,
    p_position: input.position,
    p_department: input.department,
    p_reports_to: input.reportsTo ?? null,
    p_team_key: input.teamKey?.trim() || null,
    p_product_key: input.productKey?.trim() || null,
    p_employment_type: input.employmentType,
    p_reason: input.reason,
  });
  if (error || data !== true) throw new WorkforceAdminError(400, error?.message ?? "Unable to assign job");
  return { updated: true };
}

export async function assignAccessProfile(input: { targetUserId: string; profile: string; scopeType: string; scopeKey?: string; reason: string; expiresAt?: string }) {
  const { admin, actor } = await authority();
  await requireManagedTarget(admin, actor, input.targetUserId);
  const { data: profile, error: profileError } = await admin.from("office_access_profile_catalog").select("code,assignable_by_admin,owner_managed_only").eq("code", input.profile).eq("active", true).maybeSingle();
  if (profileError || !profile) throw new WorkforceAdminError(400, "Invalid access profile");
  if (!actor.roles.includes("OWNER") && (!profile.assignable_by_admin || profile.owner_managed_only)) {
    throw new WorkforceAdminError(403, "This access profile requires OWNER authority");
  }
  const { data, error } = await admin.rpc("office_assign_access_profile", {
    p_actor: actor.userId,
    p_target: input.targetUserId,
    p_profile: input.profile,
    p_scope_type: input.scopeType,
    p_scope_key: input.scopeKey?.trim() || null,
    p_reason: input.reason,
    p_expires_at: input.expiresAt ?? null,
  });
  if (error || typeof data !== "string") throw new WorkforceAdminError(400, error?.message ?? "Unable to assign access profile");
  return { assignment_id: data };
}

export async function revokeAccessProfile(input: { targetUserId: string; assignmentId: string; reason: string }) {
  const { admin, actor } = await authority();
  await requireManagedTarget(admin, actor, input.targetUserId);
  const { data: assignment, error: assignmentError } = await admin.from("office_user_access_profiles").select("id,user_id,profile_code").eq("id", input.assignmentId).eq("user_id", input.targetUserId).maybeSingle();
  if (assignmentError || !assignment) throw new WorkforceAdminError(404, "Access-profile assignment not found");
  const { data, error } = await admin.rpc("office_revoke_access_profile", { p_actor: actor.userId, p_assignment: input.assignmentId, p_reason: input.reason });
  if (error || data !== true) throw new WorkforceAdminError(400, error?.message ?? "Unable to revoke access profile");
  return { revoked: true };
}

export async function setPermissionOverride(input: { targetUserId: string; permission: string; effect: "ALLOW" | "DENY"; scopeType: string; scopeKey?: string; reason: string; expiresAt?: string }) {
  const { admin, actor } = await authority();
  await requireManagedTarget(admin, actor, input.targetUserId);
  const { data: permission, error: permissionError } = await admin.from("office_permission_catalog").select("code,sensitivity,high_risk").eq("code", input.permission).eq("active", true).maybeSingle();
  if (permissionError || !permission) throw new WorkforceAdminError(400, "Invalid permission");
  if (input.effect === "ALLOW" && !actor.roles.includes("OWNER") && (permission.high_risk || ["HIGH", "CRITICAL"].includes(String(permission.sensitivity)))) {
    throw new WorkforceAdminError(403, "High-risk individual ALLOW overrides require OWNER authority");
  }
  const { data, error } = await admin.rpc("office_set_permission_override", {
    p_actor: actor.userId,
    p_target: input.targetUserId,
    p_permission: input.permission,
    p_effect: input.effect,
    p_scope_type: input.scopeType,
    p_scope_key: input.scopeKey?.trim() || null,
    p_reason: input.reason,
    p_expires_at: input.expiresAt ?? null,
  });
  if (error || typeof data !== "string") throw new WorkforceAdminError(400, error?.message ?? "Unable to set permission override");
  return { override_id: data };
}

export async function registerWorkforceDevice(input: { targetUserId: string; label: string; kind: string; platform?: string }) {
  const { admin, actor } = await authority();
  await requireManagedTarget(admin, actor, input.targetUserId);
  const { data, error } = await admin.rpc("office_register_device", {
    p_user: input.targetUserId,
    p_label: input.label,
    p_kind: input.kind,
    p_platform: input.platform?.trim() || null,
  });
  if (error || typeof data !== "string") throw new WorkforceAdminError(400, error?.message ?? "Unable to register device");
  return { device_id: data };
}

export async function changeDeviceTrust(input: { targetUserId: string; deviceId: string; action: "APPROVE" | "REVOKE"; companyManaged?: boolean; reason: string }) {
  const { admin, actor } = await authority();
  await requireManagedTarget(admin, actor, input.targetUserId);
  const { data: device, error: deviceError } = await admin.from("office_device_registry").select("id,user_id").eq("id", input.deviceId).eq("user_id", input.targetUserId).maybeSingle();
  if (deviceError || !device) throw new WorkforceAdminError(404, "Device not found");
  const rpc = input.action === "APPROVE" ? "office_approve_device" : "office_revoke_device";
  const args = input.action === "APPROVE"
    ? { p_actor: actor.userId, p_device: input.deviceId, p_company_managed: input.companyManaged ?? false, p_reason: input.reason }
    : { p_actor: actor.userId, p_device: input.deviceId, p_reason: input.reason };
  const { data, error } = await admin.rpc(rpc, args);
  if (error || data !== true) throw new WorkforceAdminError(400, error?.message ?? "Unable to update device trust");
  return { updated: true };
}
