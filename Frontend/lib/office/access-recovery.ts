import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getOfficeRuntimeOrigin, requireOfficeAdminEnvironment } from "@/lib/env/office";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import {
  canAdministerAccess,
  canInviteRoles,
  canManageTarget,
  isOfficeDepartment,
  type OfficeDepartment,
  type OfficeIdentityStatus,
} from "@/lib/office/access-policy";
import { isOfficeRole, type OfficeRole } from "@/lib/office/workspaces";
import { OfficeAccessError } from "@/lib/office/access-admin";

type Actor = { userId: string; email?: string; roles: OfficeRole[] };
type Target = { userId: string; email?: string; roles: OfficeRole[]; status: OfficeIdentityStatus };

function adminClient() {
  const environment = requireOfficeAdminEnvironment();
  return createClient(environment.OFFICE_SUPABASE_URL, environment.OFFICE_SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function authority(): Promise<{ admin: SupabaseClient; actor: Actor; accessToken: string }> {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) throw new OfficeAccessError(401, "Office sign-in required");
  if (context.identity.aal !== "aal2") throw new OfficeAccessError(403, "AAL2 verification is required");
  if (!canAdministerAccess(context.identity.roles)) throw new OfficeAccessError(403, "OWNER or ADMIN authority is required");
  try {
    return {
      admin: adminClient(),
      actor: { userId: context.identity.userId, email: context.identity.email, roles: context.identity.roles },
      accessToken: context.session.access_token,
    };
  } catch {
    throw new OfficeAccessError(503, "Trusted Office access administration is not configured");
  }
}

async function target(admin: SupabaseClient, userId: string): Promise<Target> {
  const [identityResult, roleResult, authResult] = await Promise.all([
    admin.from("office_identity_users").select("status").eq("user_id", userId).maybeSingle(),
    admin.from("office_user_roles").select("role,expires_at").eq("user_id", userId),
    admin.from("office_auth_users").select("id,email,founder_slot").eq("id", userId).maybeSingle(),
  ]);
  if (identityResult.error || roleResult.error || authResult.error || !identityResult.data || !authResult.data) {
    throw new OfficeAccessError(404, "Office identity not found");
  }
  const status = identityResult.data.status as OfficeIdentityStatus;
  if (!(["INVITED", "ACTIVE", "SUSPENDED", "REVOKED"] as const).includes(status)) {
    throw new OfficeAccessError(409, "Office identity state is invalid");
  }
  const now = Date.now();
  const roles = ((roleResult.data ?? []) as Array<{ role: unknown; expires_at?: unknown }>)
    .filter((row) => {
      if (typeof row.expires_at !== "string" || !row.expires_at) return true;
      const expiry = Date.parse(row.expires_at);
      return Number.isFinite(expiry) && expiry > now;
    })
    .map((row) => row.role)
    .filter(isOfficeRole);
  return {
    userId,
    email: typeof authResult.data.email === "string" ? authResult.data.email : undefined,
    roles: Array.from(new Set(roles)),
    status,
  };
}

async function audit(
  admin: SupabaseClient,
  actor: Actor,
  input: {
    targetUserId?: string;
    targetEmail?: string;
    action: string;
    department?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await admin.from("office_access_audit").insert({
    actor_user_id: actor.userId,
    actor_roles: actor.roles,
    target_user_id: input.targetUserId ?? null,
    target_email: input.targetEmail ?? null,
    action: input.action,
    department: input.department ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw new OfficeAccessError(500, "Access audit write failed");
}

async function identityApi<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const runtime = getOfficeRuntimeOrigin();
  if (!runtime) throw new OfficeAccessError(503, "KRAVIA Office identity service is unavailable");
  let response: Response;
  try {
    response = await fetch(new URL(path, runtime), {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new OfficeAccessError(503, "KRAVIA Office identity service is unavailable");
  }
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new OfficeAccessError(
      response.status,
      typeof payload.detail === "string" ? payload.detail : "KRAVIA Office identity request failed",
    );
  }
  return payload as T;
}

// Legacy Supabase invitation acceptance is intentionally disabled. Private-link
// registration is now completed by the first-party /api/v1/auth/invitation/register endpoint.
export async function acceptOfficeInvitation() {
  return false;
}

export async function revokeOfficeInvitation(input: { invitationId: string; reason: string }) {
  const { admin, actor, accessToken } = await authority();
  const { data: invitation, error } = await admin
    .from("office_access_invitations")
    .select("id,email,requested_roles,auth_user_id,status")
    .eq("id", input.invitationId)
    .maybeSingle();
  if (error || !invitation) throw new OfficeAccessError(404, "Invitation not found");
  if (invitation.status !== "PENDING") throw new OfficeAccessError(409, "Only pending invitations can be revoked");
  const requestedRoles = (Array.isArray(invitation.requested_roles) ? invitation.requested_roles : []).filter(isOfficeRole);
  const decision = canInviteRoles(actor.roles, requestedRoles);
  if (!decision.allowed) throw new OfficeAccessError(403, decision.reason);

  await identityApi(accessToken, `/api/v1/auth/invitations/${encodeURIComponent(input.invitationId)}/revoke`, {
    method: "POST",
  });

  await audit(admin, actor, {
    targetUserId: typeof invitation.auth_user_id === "string" ? invitation.auth_user_id : undefined,
    targetEmail: invitation.email,
    action: "INVITE_REVOKED",
    reason: input.reason,
    metadata: { requested_roles: requestedRoles, provider: "KRAVIA_FIRST_PARTY" },
  });
  return { revoked: true, invitation_id: invitation.id };
}

export async function changeOfficeDepartment(input: { targetUserId: string; department: OfficeDepartment; reason: string }) {
  const { admin, actor } = await authority();
  if (!isOfficeDepartment(input.department)) throw new OfficeAccessError(400, "Invalid Office department");
  const targetIdentity = await target(admin, input.targetUserId);
  if (targetIdentity.status === "INVITED" || targetIdentity.status === "REVOKED") {
    throw new OfficeAccessError(409, "Department changes require an active or suspended identity");
  }
  const decision = canManageTarget(actor.userId, actor.roles, targetIdentity.userId, targetIdentity.roles);
  if (!decision.allowed) throw new OfficeAccessError(403, decision.reason);
  const { error } = await admin.from("office_identity_users").update({ primary_department: input.department }).eq("user_id", targetIdentity.userId);
  if (error) throw new OfficeAccessError(500, "Department update failed");
  await audit(admin, actor, {
    targetUserId: targetIdentity.userId,
    targetEmail: targetIdentity.email,
    action: "DEPARTMENT_CHANGED",
    department: input.department,
    reason: input.reason,
  });
  return { updated: true, target_user_id: targetIdentity.userId, department: input.department };
}

export async function resetOfficeMfa(input: { targetUserId: string; reason: string }) {
  const { admin, actor, accessToken } = await authority();
  const targetIdentity = await target(admin, input.targetUserId);
  if (targetIdentity.status === "INVITED" || targetIdentity.status === "REVOKED") {
    throw new OfficeAccessError(409, "MFA reset requires an active or suspended identity");
  }
  const decision = canManageTarget(actor.userId, actor.roles, targetIdentity.userId, targetIdentity.roles);
  if (!decision.allowed) throw new OfficeAccessError(403, decision.reason);

  const result = await identityApi<{ reset: true; revoked_sessions: number }>(
    accessToken,
    `/api/v1/auth/users/${encodeURIComponent(input.targetUserId)}/mfa-reset`,
    { method: "POST" },
  );

  await audit(admin, actor, {
    targetUserId: targetIdentity.userId,
    targetEmail: targetIdentity.email,
    action: "MFA_RESET",
    reason: input.reason,
    metadata: { provider: "KRAVIA_FIRST_PARTY", revoked_sessions: result.revoked_sessions },
  });
  return { ...result, target_user_id: targetIdentity.userId };
}
