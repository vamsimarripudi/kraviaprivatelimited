import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getOfficeRuntimeOrigin, requireOfficeAdminEnvironment } from "@/lib/env/office";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import {
  activeRoleNames,
  canAdministerAccess,
  canChangeRole,
  canChangeStatus,
  canInviteRoles,
  canReviewAccess,
  isOfficeDepartment,
  type OfficeDepartment,
  type OfficeIdentityStatus,
  type MutableOfficeIdentityStatus,
} from "@/lib/office/access-policy";
import type { OfficeRole } from "@/lib/office/workspaces";

export class OfficeAccessError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeAccessError";
  }
}

type AccessActor = { userId: string; email?: string; roles: OfficeRole[] };
type TargetAccess = { userId: string; email?: string; status: OfficeIdentityStatus; roles: OfficeRole[] };

type ErrorLike = { message?: string } | null;
type AuthDirectoryUser = { id: string; email?: string | null; last_login_at?: string | null; display_name?: string | null; founder_slot?: string | null; mfa_verified_at?: string | null };

function createOfficeAdminClient() {
  const environment = requireOfficeAdminEnvironment();
  return createClient(environment.OFFICE_SUPABASE_URL, environment.OFFICE_SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function failIf(error: ErrorLike, message: string) {
  if (error) throw new OfficeAccessError(500, message);
}

async function requireAccessAdministrator(): Promise<{ admin: SupabaseClient; actor: AccessActor; accessToken: string }> {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) throw new OfficeAccessError(401, "Office sign-in required");
  if (context.identity.aal !== "aal2") throw new OfficeAccessError(403, "AAL2 verification is required for access administration");
  if (!canAdministerAccess(context.identity.roles)) throw new OfficeAccessError(403, "OWNER or ADMIN authority is required");
  try {
    return {
      admin: createOfficeAdminClient(),
      actor: { userId: context.identity.userId, email: context.identity.email, roles: context.identity.roles },
      accessToken: context.session.access_token,
    };
  } catch {
    throw new OfficeAccessError(503, "Trusted Office access administration is not configured");
  }
}

async function listAllAuthUsers(admin: SupabaseClient): Promise<AuthDirectoryUser[]> {
  const { data, error } = await admin
    .from("office_auth_users")
    .select("id,email,last_login_at,display_name,founder_slot,mfa_verified_at")
    .order("created_at", { ascending: true })
    .limit(5000);
  failIf(error, "Unable to list KRAVIA Office identities");
  return (data ?? []) as AuthDirectoryUser[];
}

async function existingAuthUserByEmail(admin: SupabaseClient, email: string) {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await admin.from("office_auth_users").select("id,email").eq("email", normalized).maybeSingle();
  failIf(error, "Unable to inspect existing Office users");
  return data;
}

async function targetAccess(admin: SupabaseClient, userId: string): Promise<TargetAccess> {
  const [identityResult, rolesResult, authResult] = await Promise.all([
    admin.from("office_identity_users").select("status").eq("user_id", userId).maybeSingle(),
    admin.from("office_user_roles").select("role,expires_at").eq("user_id", userId),
    admin.from("office_auth_users").select("id,email").eq("id", userId).maybeSingle(),
  ]);
  if (identityResult.error || rolesResult.error || authResult.error || !identityResult.data || !authResult.data) {
    throw new OfficeAccessError(404, "Office identity not found");
  }
  const status = identityResult.data.status as OfficeIdentityStatus;
  if (!( ["INVITED", "ACTIVE", "SUSPENDED", "REVOKED"] as const).includes(status)) {
    throw new OfficeAccessError(409, "Office identity state is invalid");
  }
  return {
    userId,
    email: authResult.data.email ?? undefined,
    status,
    roles: activeRoleNames((rolesResult.data ?? []) as { role: unknown; expires_at?: unknown }[]),
  };
}

async function writeAudit(admin: SupabaseClient, actor: AccessActor, input: {
  targetUserId?: string;
  targetEmail?: string;
  action: string;
  role?: OfficeRole;
  department?: OfficeDepartment;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await admin.from("office_access_audit").insert({
    actor_user_id: actor.userId,
    actor_roles: actor.roles,
    target_user_id: input.targetUserId ?? null,
    target_email: input.targetEmail ?? null,
    action: input.action,
    role: input.role ?? null,
    department: input.department ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
  failIf(error, "Access audit write failed");
}

export async function listOfficeAccessState() {
  const { admin, actor } = await requireAccessAdministrator();
  const nowMs = Date.now();
  const [authUsers, identityResult, roleResult, catalogResult, departmentResult, invitationResult, auditResult] = await Promise.all([
    listAllAuthUsers(admin),
    admin.from("office_identity_users").select("user_id,status,display_name,job_title,primary_department,authorization_version,last_role_change_at,last_access_review_at,access_review_due_at,created_at,updated_at").order("created_at", { ascending: true }),
    admin.from("office_user_roles").select("user_id,role,granted_by,grant_reason,expires_at,created_at,updated_at").order("created_at", { ascending: true }),
    admin.from("office_role_catalog").select("role,label,description,workspace_scope,privilege_tier,owner_managed_only,assignable_by_admin,active").eq("active", true).order("privilege_tier", { ascending: false }),
    admin.from("office_department_catalog").select("code,label,description,active").eq("active", true).order("label", { ascending: true }),
    admin.from("office_access_invitations").select("id,email,display_name,job_title,department,requested_roles,status,auth_user_id,expires_at,accepted_at,created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("office_access_audit").select("id,actor_user_id,actor_roles,target_user_id,target_email,action,role,department,reason,metadata,created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  failIf(identityResult.error, "Unable to list Office identities");
  failIf(roleResult.error, "Unable to list Office roles");
  failIf(catalogResult.error, "Unable to read Office role catalog");
  failIf(departmentResult.error, "Unable to read Office department catalog");
  failIf(invitationResult.error, "Unable to read Office invitations");
  failIf(auditResult.error, "Unable to read Office access audit");

  const authMap = new Map(authUsers.map((user) => [user.id, user]));
  const rolesByUser = new Map<string, Array<Record<string, unknown>>>();
  for (const raw of (roleResult.data ?? []) as Array<Record<string, unknown>>) {
    if (typeof raw.user_id !== "string") continue;
    const existing = rolesByUser.get(raw.user_id) ?? [];
    existing.push(raw);
    rolesByUser.set(raw.user_id, existing);
  }

  const users = ((identityResult.data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const userId = String(row.user_id ?? "");
    const authUser = authMap.get(userId);
    const roleRows = rolesByUser.get(userId) ?? [];
    return {
      user_id: userId,
      email: authUser?.email ?? null,
      email_confirmed: true,
      last_sign_in_at: authUser?.last_login_at ?? null,
      status: row.status,
      display_name: row.display_name,
      job_title: row.job_title,
      department: row.primary_department,
      authorization_version: row.authorization_version,
      last_role_change_at: row.last_role_change_at,
      last_access_review_at: row.last_access_review_at,
      access_review_due_at: row.access_review_due_at,
      roles: roleRows.map((roleRow) => {
        const expiresAt = typeof roleRow.expires_at === "string" ? roleRow.expires_at : null;
        const expiryMs = expiresAt ? Date.parse(expiresAt) : Number.POSITIVE_INFINITY;
        return {
          role: roleRow.role,
          granted_by: roleRow.granted_by,
          grant_reason: roleRow.grant_reason,
          expires_at: expiresAt,
          created_at: roleRow.created_at,
          active: !expiresAt || (Number.isFinite(expiryMs) && expiryMs > nowMs),
        };
      }),
    };
  });

  return {
    actor,
    users,
    role_catalog: catalogResult.data ?? [],
    departments: departmentResult.data ?? [],
    invitations: invitationResult.data ?? [],
    audit: auditResult.data ?? [],
  };
}

export async function inviteOfficeUser(input: {
  email: string;
  displayName?: string;
  jobTitle?: string;
  department: OfficeDepartment;
  roles: OfficeRole[];
  reason: string;
  origin: string;
}) {
  const { admin, actor, accessToken } = await requireAccessAdministrator();
  const decision = canInviteRoles(actor.roles, input.roles);
  if (!decision.allowed) throw new OfficeAccessError(403, decision.reason);
  if (!isOfficeDepartment(input.department)) throw new OfficeAccessError(400, "Invalid Office department");
  const existing = await existingAuthUserByEmail(admin, input.email);
  if (existing) throw new OfficeAccessError(409, "That email already exists in KRAVIA Office");

  const runtime = getOfficeRuntimeOrigin();
  if (!runtime) throw new OfficeAccessError(503, "KRAVIA Office identity service is unavailable");
  let response: Response;
  try {
    response = await fetch(new URL("/api/v1/auth/invitations", runtime), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        display_name: input.displayName || undefined,
        job_title: input.jobTitle || undefined,
        department: input.department,
        roles: input.roles,
        reason: input.reason,
      }),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new OfficeAccessError(503, "KRAVIA Office invitation service is unavailable");
  }
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new OfficeAccessError(response.status, typeof payload.detail === "string" ? payload.detail : "Office invitation failed");
  }
  const registrationPath = typeof payload.registration_path === "string" ? payload.registration_path : "";
  const registrationUrl = registrationPath ? new URL(registrationPath, input.origin).toString() : "";
  return { ...payload, registration_url: registrationUrl };
}

export async function changeOfficeRole(input: { targetUserId: string; role: OfficeRole; action: "GRANT" | "REVOKE"; expiresAt?: string; reason: string }) {
  const { admin, actor } = await requireAccessAdministrator();
  const target = await targetAccess(admin, input.targetUserId);
  if (target.status === "INVITED") throw new OfficeAccessError(409, "Pending invitations must be accepted or revoked before role administration");
  if (target.status === "REVOKED") throw new OfficeAccessError(409, "REVOKED identities cannot be role-edited");
  const decision = canChangeRole(actor.userId, actor.roles, target.userId, target.roles, input.role, input.action);
  if (!decision.allowed) throw new OfficeAccessError(403, decision.reason);

  if (input.action === "GRANT") {
    let expiresAt: string | null = null;
    if (input.expiresAt) {
      const parsed = Date.parse(input.expiresAt);
      if (!Number.isFinite(parsed) || parsed <= Date.now()) throw new OfficeAccessError(400, "Role expiry must be a future date/time");
      expiresAt = new Date(parsed).toISOString();
    }
    const { error } = await admin.from("office_user_roles").upsert({
      user_id: target.userId,
      role: input.role,
      granted_by: actor.userId,
      grant_reason: input.reason,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,role" });
    failIf(error, "Role grant failed");
    await writeAudit(admin, actor, { targetUserId: target.userId, targetEmail: target.email, action: "ROLE_GRANTED", role: input.role, reason: input.reason, metadata: { expires_at: expiresAt } });
  } else {
    const { error } = await admin.from("office_user_roles").delete().eq("user_id", target.userId).eq("role", input.role);
    failIf(error, "Role revocation failed");
    await writeAudit(admin, actor, { targetUserId: target.userId, targetEmail: target.email, action: "ROLE_REVOKED", role: input.role, reason: input.reason });
  }
  return { updated: true, action: input.action, role: input.role, target_user_id: target.userId };
}

export async function changeOfficeIdentityStatus(input: { targetUserId: string; status: MutableOfficeIdentityStatus; reason: string }) {
  const { admin, actor } = await requireAccessAdministrator();
  const target = await targetAccess(admin, input.targetUserId);
  if (target.status === "INVITED") throw new OfficeAccessError(409, "Pending invitations are controlled by invitation acceptance or revocation");
  if (target.status === "REVOKED" && input.status === "ACTIVE") throw new OfficeAccessError(409, "REVOKED identities require a new controlled onboarding decision");
  const decision = canChangeStatus(actor.userId, actor.roles, target.userId, target.roles, input.status);
  if (!decision.allowed) throw new OfficeAccessError(403, decision.reason);

  const { error } = await admin.from("office_identity_users").update({ status: input.status }).eq("user_id", target.userId);
  failIf(error, "Identity status update failed");
  const action = input.status === "ACTIVE"
    ? (target.status === "SUSPENDED" ? "IDENTITY_REACTIVATED" : "IDENTITY_ACTIVATED")
    : input.status === "SUSPENDED" ? "IDENTITY_SUSPENDED" : "IDENTITY_REVOKED";
  await writeAudit(admin, actor, { targetUserId: target.userId, targetEmail: target.email, action, reason: input.reason });
  return { updated: true, status: input.status, target_user_id: target.userId };
}

export async function reviewOfficeAccess(input: { targetUserId: string; decision: "APPROVED" | "CHANGES_REQUIRED"; notes?: string }) {
  const { admin, actor } = await requireAccessAdministrator();
  const target = await targetAccess(admin, input.targetUserId);
  if (target.status === "INVITED" || target.status === "REVOKED") throw new OfficeAccessError(409, "Only active or suspended identities can complete an access review");
  const decision = canReviewAccess(actor.userId, actor.roles, target.userId, target.roles);
  if (!decision.allowed) throw new OfficeAccessError(403, decision.reason);

  const now = new Date();
  const nextDue = new Date(now.getTime() + (input.decision === "APPROVED" ? 90 : 7) * 24 * 60 * 60 * 1000);
  const { error: identityError } = await admin.from("office_identity_users").update({
    last_access_review_at: now.toISOString(),
    access_review_due_at: nextDue.toISOString(),
  }).eq("user_id", target.userId);
  failIf(identityError, "Unable to update access-review schedule");

  const { error: reviewError } = await admin.from("office_access_reviews").insert({
    user_id: target.userId,
    status: input.decision,
    due_at: nextDue.toISOString(),
    reviewed_by: actor.userId,
    reviewed_at: now.toISOString(),
    notes: input.notes?.trim() || null,
  });
  failIf(reviewError, "Unable to record access review");

  await writeAudit(admin, actor, {
    targetUserId: target.userId,
    targetEmail: target.email,
    action: input.decision === "APPROVED" ? "ACCESS_REVIEW_APPROVED" : "ACCESS_REVIEW_CHANGES_REQUIRED",
    reason: input.notes?.trim() || undefined,
    metadata: { next_due_at: nextDue.toISOString() },
  });
  return { reviewed: true, decision: input.decision, next_due_at: nextDue.toISOString() };
}
