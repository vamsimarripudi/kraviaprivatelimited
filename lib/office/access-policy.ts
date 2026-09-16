import { isOfficeRole, type OfficeRole } from "@/lib/office/workspaces";

export const officeDepartments = [
  "EXECUTIVE",
  "ADMINISTRATION",
  "ENGINEERING",
  "DEVOPS",
  "SECURITY",
  "IT",
  "QUALITY",
  "PRODUCT",
  "PEOPLE",
  "FINANCE",
  "TAX",
  "SECRETARIAL",
  "LEGAL",
  "SALES",
  "MARKETING",
  "CUSTOMER_SUCCESS",
  "SUPPORT",
  "OPERATIONS",
  "PROCUREMENT",
  "AUDIT",
] as const;

export type OfficeDepartment = (typeof officeDepartments)[number];
export type OfficeIdentityStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REVOKED";
export type MutableOfficeIdentityStatus = Exclude<OfficeIdentityStatus, "INVITED">;

export const ownerManagedRoles: readonly OfficeRole[] = ["OWNER", "DIRECTOR", "ADMIN"];
export const adminAssignableRoles: readonly OfficeRole[] = ["MEMBER", "FINANCE", "CA", "CS", "LEGAL", "HR", "OPERATIONS", "AUDITOR", "PRODUCT_ADMIN"];
export type AccessDecision = { allowed: true } | { allowed: false; reason: string };

export function isOfficeDepartment(value: unknown): value is OfficeDepartment {
  return typeof value === "string" && (officeDepartments as readonly string[]).includes(value);
}

export function activeRoleNames(rows: readonly { role: unknown; expires_at?: unknown }[], now = Date.now()): OfficeRole[] {
  const roles = rows
    .filter((row) => {
      if (typeof row.expires_at !== "string" || !row.expires_at) return true;
      const expiry = Date.parse(row.expires_at);
      return Number.isFinite(expiry) && expiry > now;
    })
    .map((row) => row.role)
    .filter(isOfficeRole);
  return Array.from(new Set(roles));
}

export function hasRoleConflict(roles: readonly OfficeRole[]) {
  const set = new Set(roles);
  if (!set.has("AUDITOR")) return false;
  return ["OWNER", "DIRECTOR", "ADMIN", "FINANCE"].some((role) => set.has(role as OfficeRole));
}

export function canAdministerAccess(roles: readonly OfficeRole[]) {
  return roles.includes("OWNER") || roles.includes("ADMIN");
}

export function canInviteRoles(actorRoles: readonly OfficeRole[], requestedRoles: readonly OfficeRole[]): AccessDecision {
  if (!requestedRoles.length) return { allowed: false, reason: "At least one Office role is required" };
  if (requestedRoles.includes("OWNER")) return { allowed: false, reason: "OWNER is not assignable through ordinary onboarding" };
  if (hasRoleConflict(requestedRoles)) return { allowed: false, reason: "AUDITOR cannot be combined with privileged or finance-execution roles" };
  if (actorRoles.includes("OWNER")) return { allowed: true };
  if (actorRoles.includes("ADMIN") && requestedRoles.every((role) => adminAssignableRoles.includes(role))) return { allowed: true };
  return { allowed: false, reason: "The requested role set exceeds the administrator's delegated authority" };
}

function targetIsPrivileged(targetRoles: readonly OfficeRole[]) {
  return targetRoles.some((role) => ownerManagedRoles.includes(role));
}

export function canManageTarget(actorUserId: string, actorRoles: readonly OfficeRole[], targetUserId: string, targetRoles: readonly OfficeRole[]): AccessDecision {
  if (targetRoles.includes("OWNER")) return { allowed: false, reason: "OWNER is protected from ordinary access administration" };
  if (actorRoles.includes("OWNER")) return { allowed: true };
  if (!actorRoles.includes("ADMIN")) return { allowed: false, reason: "Access administration requires OWNER or ADMIN" };
  if (actorUserId === targetUserId) return { allowed: false, reason: "ADMIN cannot change its own privileges" };
  if (targetIsPrivileged(targetRoles)) return { allowed: false, reason: "ADMIN cannot manage OWNER, DIRECTOR or ADMIN identities" };
  return { allowed: true };
}

export function canChangeRole(actorUserId: string, actorRoles: readonly OfficeRole[], targetUserId: string, targetRoles: readonly OfficeRole[], role: OfficeRole, action: "GRANT" | "REVOKE"): AccessDecision {
  const targetDecision = canManageTarget(actorUserId, actorRoles, targetUserId, targetRoles);
  if (!targetDecision.allowed) return targetDecision;
  if (role === "OWNER") return { allowed: false, reason: "OWNER cannot be granted or revoked through ordinary role administration" };
  const prospective = action === "GRANT" ? Array.from(new Set([...targetRoles, role])) : targetRoles.filter((existing) => existing !== role);
  if (hasRoleConflict(prospective)) return { allowed: false, reason: "The resulting role combination violates separation of duties" };
  if (actorRoles.includes("OWNER")) return { allowed: true };
  if (!adminAssignableRoles.includes(role)) return { allowed: false, reason: "ADMIN cannot grant or revoke privileged roles" };
  return { allowed: true };
}

export function canChangeStatus(actorUserId: string, actorRoles: readonly OfficeRole[], targetUserId: string, targetRoles: readonly OfficeRole[], nextStatus: MutableOfficeIdentityStatus): AccessDecision {
  const targetDecision = canManageTarget(actorUserId, actorRoles, targetUserId, targetRoles);
  if (!targetDecision.allowed) return targetDecision;
  if (!( ["ACTIVE", "SUSPENDED", "REVOKED"] as const).includes(nextStatus)) return { allowed: false, reason: "Invalid identity status" };
  return { allowed: true };
}

export function canReviewAccess(actorUserId: string, actorRoles: readonly OfficeRole[], targetUserId: string, targetRoles: readonly OfficeRole[]): AccessDecision {
  if (actorUserId === targetUserId) return { allowed: false, reason: "Access reviews require another authorised reviewer" };
  return canManageTarget(actorUserId, actorRoles, targetUserId, targetRoles);
}

export function suggestedDepartmentForRoles(roles: readonly OfficeRole[]): OfficeDepartment {
  if (roles.includes("ADMIN")) return "ADMINISTRATION";
  if (roles.includes("DIRECTOR")) return "EXECUTIVE";
  if (roles.includes("CA")) return "TAX";
  if (roles.includes("FINANCE")) return "FINANCE";
  if (roles.includes("CS")) return "SECRETARIAL";
  if (roles.includes("LEGAL")) return "LEGAL";
  if (roles.includes("HR")) return "PEOPLE";
  if (roles.includes("AUDITOR")) return "AUDIT";
  if (roles.includes("PRODUCT_ADMIN")) return "PRODUCT";
  return "OPERATIONS";
}
