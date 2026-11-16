import "server-only";

import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";

export class FounderDeviceReviewError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "FounderDeviceReviewError";
  }
}

type Actor = Awaited<ReturnType<typeof requireOfficeActor>>;
const permittedRoles = ["DIRECTOR", "ADMIN"] as const;

async function currentActor(): Promise<Actor> {
  try {
    return await requireOfficeActor();
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new FounderDeviceReviewError(error.status, error.message);
    throw error;
  }
}

function canIndependentlyReview(roles: readonly string[]) {
  return permittedRoles.some(role => roles.includes(role)) && !roles.includes("OWNER");
}

function dbError(error: { message?: string } | null, fallback: string) {
  const reason = error?.message ?? fallback;
  // These errors contain no secrets; expose only known controlled failures.
  const known = [
    "Only a pending/revoked company computer",
    "This recovery flow applies only",
    "An independent, active Administrator or Director",
    "Every security control must be confirmed",
    "Company management evidence is required",
    "Provide Windows version",
    "Device review is not awaiting approval",
    "The device state has changed",
    "A second independent active Administrator/Director",
    "Provide a meaningful signed approval reason",
    "Recovery review is stale",
    "Independent review evidence is no longer current",
    "Device limit reached",
  ];
  return new FounderDeviceReviewError(409, known.find(part => reason.includes(part)) ?? fallback);
}

export async function getFounderDeviceRecoveryOverview() {
  const current = await currentActor();
  const staff = canIndependentlyReview(current.identity.roles);
  const owner = current.identity.roles.includes("OWNER");
  if (!staff && !owner) throw new FounderDeviceReviewError(403, "Founder device recovery is not in your assigned scope");

  const { data: roleRows, error: roleError } = await current.admin.from("office_user_roles")
    .select("user_id,expires_at").eq("role", "OWNER");
  if (roleError) throw new FounderDeviceReviewError(503, "Founder device registry is unavailable");
  const ownerIds = (roleRows ?? []).filter(row =>
    !row.expires_at || Date.parse(row.expires_at) > Date.now()).map(row => String(row.user_id));
  const visibleIds = owner ? ownerIds.filter(id => id === current.identity.userId) : ownerIds;
  if (!visibleIds.length) return { actor: { id: current.identity.userId, roles: current.identity.roles }, devices: [], can_review: staff };

  const { data: devices, error: deviceError } = await current.admin.from("office_device_registry")
    .select("id,user_id,device_label,device_kind,platform,trust_state,company_managed,bound_at,approved_at,revoked_at")
    .in("user_id", visibleIds)
    .in("device_kind", ["LAPTOP", "DESKTOP"])
    .order("created_at", { ascending: false }).limit(35);
  if (deviceError) throw new FounderDeviceReviewError(503, "Founder device registry is unavailable");
  const ids = (devices ?? []).map(device => String(device.id));
  if (!ids.length) return { actor: { id: current.identity.userId, roles: current.identity.roles }, devices: [], can_review: staff };

  const [reviewsResult, postureResult] = await Promise.all([
    current.admin.from("office_founder_device_reviews")
      .select("id,device_id,subject_user_id,reviewer_user_id,reviewed_at,company_managed_verified,status,approved_by,approved_at")
      .in("device_id", ids).order("reviewed_at", { ascending: false }).limit(140),
    current.admin.from("office_device_posture_snapshots")
      .select("id,device_id,checked_at,recorded_by,compliance_status,compromise_detected,encryption_enabled,screen_lock_enabled,security_agent_healthy,patch_current,firewall_enabled")
      .in("device_id", ids).order("checked_at", { ascending: false }).limit(140),
  ]);
  if (reviewsResult.error || postureResult.error)
    throw new FounderDeviceReviewError(503, "Founder security review records are unavailable. Apply the reviewed migration before using this workflow.");
  const latestReview = new Map<string, NonNullable<typeof reviewsResult.data>[number]>();
  for (const row of reviewsResult.data ?? []) if (!latestReview.has(row.device_id)) latestReview.set(row.device_id, row);
  const latestPosture = new Map<string, NonNullable<typeof postureResult.data>[number]>();
  for (const row of postureResult.data ?? []) if (!latestPosture.has(row.device_id)) latestPosture.set(row.device_id, row);

  return {
    actor: { id: current.identity.userId, roles: current.identity.roles },
    can_review: staff,
    devices: (devices ?? []).map(device => {
      const review = latestReview.get(device.id);
      const posture = latestPosture.get(device.id);
      return {
        ...device,
        reviewer_can_attest: staff && current.identity.userId !== device.user_id && ["PENDING", "REVOKED"].includes(device.trust_state),
        approver_can_sign: staff && review?.status === "PENDING" &&
          review.reviewer_user_id !== current.identity.userId &&
          review.subject_user_id !== current.identity.userId &&
          ["PENDING", "REVOKED"].includes(device.trust_state),
        review: review ? {
          id: review.id, status: review.status,
          reviewer_user_id: review.reviewer_user_id, reviewed_at: review.reviewed_at,
          company_managed_verified: review.company_managed_verified,
          approved_at: review.approved_at,
        } : null,
        latest_posture: posture ? {
          checked_at: posture.checked_at, status: posture.compliance_status,
          compromise: posture.compromise_detected,
          encryption: posture.encryption_enabled, screen_lock: posture.screen_lock_enabled,
          security_agent: posture.security_agent_healthy, patch_current: posture.patch_current,
          firewall: posture.firewall_enabled,
        } : null,
      };
    }),
  };
}

export async function submitFounderDeviceSecurityReview(input: {
  deviceId: string; osVersion: string; encryption: boolean; screenLock: boolean;
  securityAgent: boolean; patchCurrent: boolean; firewall: boolean; compromise: boolean;
  companyManaged: boolean; managementEvidence: string; notes: string;
}) {
  const current = await currentActor();
  if (!canIndependentlyReview(current.identity.roles))
    throw new FounderDeviceReviewError(403, "A separate active Director or Administrator must complete the device review");
  const { data, error } = await current.admin.rpc("office_review_founder_device", {
    p_actor: current.identity.userId,
    p_device: input.deviceId,
    p_os: input.osVersion,
    p_encryption: input.encryption,
    p_screen_lock: input.screenLock,
    p_agent: input.securityAgent,
    p_patch: input.patchCurrent,
    p_firewall: input.firewall,
    p_compromise: input.compromise,
    p_company_managed: input.companyManaged,
    p_management_evidence: input.managementEvidence,
    p_notes: input.notes,
  });
  if (error || typeof data !== "string") throw dbError(error, "Independent security review was not accepted");
  return { review_id: data, state: "AWAITING_INDEPENDENT_APPROVAL", device_trust_changed: false };
}

export async function approveReviewedFounderDevice(input: { reviewId: string; reason: string }) {
  const current = await currentActor();
  if (!canIndependentlyReview(current.identity.roles))
    throw new FounderDeviceReviewError(403, "A separate active Director or Administrator must approve the device");
  const { data, error } = await current.admin.rpc("office_approve_founder_device", {
    p_actor: current.identity.userId,
    p_review: input.reviewId,
    p_reason: input.reason,
  });
  if (error || data !== true) throw dbError(error, "Independent device approval was not accepted");
  return { approved: true, state: "TRUSTED_AWAITING_BROWSER_BINDING" };
}
