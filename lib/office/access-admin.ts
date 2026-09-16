import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { requireOfficeAdminEnvironment } from "@/lib/env/office";
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

function createOfficeAdminClient() {
  const environment = requireOfficeAdminEnvironment();
  return createClient(environment.OFFICE_SUPABASE_URL, environment.OFFICE_SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function failIf(error: ErrorLike, message: string) {
  if (error) throw new OfficeAccessError(500, message);
}

async function requireAccessAdministrator(): Promise<{ admin: SupabaseClient; actor: AccessActor }> {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) throw new OfficeAccessError(401, "Office sign-in required");
  if (context.identity.aal !== "aal2") throw new OfficeAccessError(403, "AAL2 verification is required for access administration");
  if (!canAdministerAccess(context.identity.roles)) throw new OfficeAccessError(403, "OWNER or ADMIN authority is required");
  try {
    return {
      admin: createOfficeAdminClient(),
      actor: { userId: context.identity.userId, email: context.identity.email, roles: context.identity.roles },
    };
  } catch {
    throw new OfficeAccessError(503, "Trusted Office access administration is not configured");
  }
}

async function listAllAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const perPage = 200;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    failIf(error, "Unable to list Office auth users");
    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < perPage) return users;
  }
  throw new OfficeAccessError(503, "Office user directory exceeds the supported administrative listing window");
}

async function existingAuthUserByEmail(admin: SupabaseClient, email: string) {
  const normalized = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    failIf(error, "Unable to inspect existing Office users");
    const match = (data.users ?? []).find((user) => user.email?.toLowerCase() === normalized);
    if (match) return match;
    if ((data.users ?? []).length < perPage) return null;
  }
  throw new OfficeAccessError(503, "Office user directory exceeds the supported administrative lookup window");
}

async function targetAccess(admin: SupabaseClient, userId: string): Promise<TargetAccess> {
  const [identityResult, rolesResult, authResult] = await Promise.all([
    admin.from("office_identity_users").select("status").eq("user_id", userId).maybeSingle(),
    admin.from("office_user_roles").select("role,expires_at").eq("user_id", userId),
    admin.auth.admin.getUserById(userId),
  ]);
  if (identityResult.error || rolesResult.error || authResult.error || !identityResult.data || !authResult.data.user) {
    throw new OfficeAccessError(404, "Office identity not found");
  }
  const status = identityResult.data.status as OfficeIdentityStatus;
  if (!( ["INVITED", "ACTIVE", "SUSPENDED", "REVOKED"] as const).includes(status)) {
    throw new OfficeAccessError(409, "Office identity state is invalid");
  }
  return {
    userId,
    email: authResult.data.user.email,
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
      email_confirmed: Boolean(authUser?.email_confirmed_at),
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
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
  const { admin, actor } = await requireAccessAdministrator();
  const decision = canInviteRoles(actor.roles, input.roles);
  if (!decision.allowed) throw new OfficeAccessError(403, decision.reason);
  if (!isOfficeDepartment(input.department)) throw new OfficeAccessError(400, "Invalid Office department");
  const existing = await existingAuthUserByEmail(admin, input.email);
  if (existing) throw new OfficeAccessError(409, "That email already exists in KRAVIA Office Auth");
  const { data: pendingInvite, error: pendingError } = await admin.from("office_access_invitations").select("id").eq("status", "PENDING").ilike("email", input.email.trim()).maybeSingle();
  failIf(pendingError, "Unable to check pending invitations");
  if (pendingInvite) throw new OfficeAccessError(409, "A pending Office invitation already exists for that email");

  let invitedUserId: string | undefined;
  try {
    const redirect = new URL("/office/activate", input.origin).toString();
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email.trim(), { redirectTo: redirect });
    if (inviteError || !inviteData.user) throw new OfficeAccessError(502, "Supabase could not issue the Office invitation");
    invitedUserId = inviteData.user.id;

    const { error: identityError } = await admin.from("office_identity_users").insert({
      user_id: invitedUserId,
      status: "INVITED",
      display_name: input.displayName?.trim() || null,
      job_title: input.jobTitle?.trim() || null,
      primary_department: input.department,
      created_by: actor.userId,
    });
    failIf(identityError, "Unable to stage the invited Office identity");

    const { error: roleError } = await admin.from("office_user_roles").insert(input.roles.map((role) => ({
      user_id: invitedUserId,
      role,
      granted_by: actor.userId,
      grant_reason: input.reason,
    })));
    failIf(roleError, "Unable to stage the invited Office roles");

    const now = Date.now();
    const expiresAt = new Date(now + 60 * 60 * 1000).toISOString();
    const { error: invitationError } = await admin.from("office_access_invitations").insert({
      email: input.email.trim().toLowerCase(),
      display_name: input.displayName?.trim() || null,
      job_title: input.jobTitle?.trim() || null,
      department: input.department,
      requested_roles: input.roles,
      requested_by: actor.userId,
      auth_user_id: invitedUserId,
      expires_at: expiresAt,
    });
    failIf(invitationError, "Unable to record the Office invitation");

    const { error: reviewError } = await admin.from("office_access_reviews").insert({
      user_id: invitedUserId,
      status: "PENDING",
      due_at: new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
    failIf(reviewError, "Unable to schedule the Office access review");

    await writeAudit(admin, actor, {
      targetUserId: invitedUserId,
      targetEmail: input.email.trim().toLowerCase(),
      action: "INVITE_CREATED",
      department: input.department,
      reason: input.reason,
      metadata: { roles: input.roles },
    });
    return { invited: true, user_id: invitedUserId, email: input.email.trim().toLowerCase(), roles: input.roles, department: input.department };
  } catch (error) {
    if (invitedUserId) {
      await admin.from("office_access_invitations").delete().eq("auth_user_id", invitedUserId).eq("status", "PENDING");
      try { await admin.auth.admin.deleteUser(invitedUserId); } catch { /* Identity remains unusable if provider cleanup is unavailable. */ }
    }
    if (error instanceof OfficeAccessError) throw error;
    throw new OfficeAccessError(500, "Office invitation provisioning failed");
  }
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
