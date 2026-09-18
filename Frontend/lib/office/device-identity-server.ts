import "server-only";

import { createHash, randomBytes } from "node:crypto";
import {
  OfficePermissionError,
  requireOfficeActor,
  requireOfficePermission,
  resolveOfficePermission,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeDeviceIdentityError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeDeviceIdentityError";
  }
}

type Actor = Awaited<ReturnType<typeof requireOfficeActor>>;

async function actor(): Promise<Actor> {
  try { return await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeDeviceIdentityError(error.status, error.message);
    throw error;
  }
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function allowed(current: Actor, permission: string, resource: OfficeResourceScope) {
  const deviceId = await currentOfficeTrustedDeviceId(current.admin, current.identity.userId);
  return (await resolveOfficePermission(current.admin, current.identity, permission, resource, deviceId)).allowed;
}

export async function getOfficeDeviceIdentityOverview() {
  const current = await actor();
  const [companyCards, ownCard, postureRead, physicalRead, cardManage, postureManage, physicalManage] = await Promise.all([
    allowed(current, "identity.card.read", { type: "COMPANY" }),
    allowed(current, "identity.card.read", { type: "OWN", ownerUserId: current.identity.userId }),
    allowed(current, "device.posture.read", { type: "COMPANY" }),
    allowed(current, "physical.access.read", { type: "COMPANY" }),
    allowed(current, "identity.card.manage", { type: "COMPANY" }),
    allowed(current, "device.posture.manage", { type: "COMPANY" }),
    allowed(current, "physical.access.manage", { type: "COMPANY" }),
  ]);
  if (!companyCards && !ownCard && !postureRead && !physicalRead) {
    throw new OfficeDeviceIdentityError(403, "Identity or device visibility is not assigned");
  }

  const identityQuery = current.admin.from("office_identity_users")
    .select("user_id,status,display_name,job_title,primary_department")
    .order("display_name");
  const credentialsQuery = current.admin.from("office_identity_credentials")
    .select("id,credential_code,user_id,credential_kind,status,issued_by,issued_at,expires_at,revoked_by,revoked_at,revocation_reason,metadata,created_at,updated_at")
    .order("issued_at", { ascending: false });
  const devicesQuery = current.admin.from("office_device_registry")
    .select("id,user_id,device_label,device_kind,platform,trust_state,company_managed,approved_by,approved_at,revoked_at,last_seen_at,bound_at,created_at,updated_at")
    .order("created_at", { ascending: false });
  const zonesQuery = current.admin.from("office_physical_access_zones")
    .select("id,zone_code,name,classification,description,active,created_at,updated_at")
    .order("zone_code");
  const grantsQuery = current.admin.from("office_physical_access_grants")
    .select("id,user_id,zone_id,credential_id,effective_from,effective_to,status,approved_by,reason,revoked_by,revoked_at,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (!companyCards) credentialsQuery.eq("user_id", current.identity.userId);
  if (!postureRead) devicesQuery.eq("user_id", current.identity.userId);
  if (!physicalRead && !physicalManage) {
    zonesQuery.limit(0);
    grantsQuery.eq("user_id", current.identity.userId);
  }

  const [identities, credentials, devices, zones, grants] = await Promise.all([
    companyCards || cardManage || physicalManage ? identityQuery : identityQuery.eq("user_id", current.identity.userId).limit(1),
    credentialsQuery,
    devicesQuery,
    zonesQuery,
    grantsQuery,
  ]);
  for (const result of [identities, credentials, devices, zones, grants]) {
    if (result.error) throw new OfficeDeviceIdentityError(503, "Identity and device control records are temporarily unavailable");
  }

  const deviceIds = (devices.data ?? []).map((row) => String(row.id));
  const postures = postureRead && deviceIds.length
    ? await current.admin.from("office_device_posture_snapshots")
        .select("id,device_id,recorded_by,checked_at,os_version,encryption_enabled,screen_lock_enabled,security_agent_healthy,patch_current,firewall_enabled,compromise_detected,compliance_status,source,details")
        .in("device_id", deviceIds)
        .order("checked_at", { ascending: false })
        .limit(1200)
    : { data: [], error: null };
  if (postures.error) throw new OfficeDeviceIdentityError(503, "Device posture records are temporarily unavailable");

  const events = physicalRead || physicalManage || cardManage
    ? await current.admin.from("office_physical_access_events")
        .select("id,user_id,credential_id,zone_id,event_type,actor_user_id,reason,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(600)
    : { data: [], error: null };
  if (events.error) throw new OfficeDeviceIdentityError(503, "Physical identity audit is temporarily unavailable");

  return {
    actor: { user_id: current.identity.userId, roles: current.identity.roles, department: current.identity.department ?? null },
    capabilities: {
      company_cards: companyCards,
      own_card: ownCard,
      posture_read: postureRead,
      physical_read: physicalRead,
      card_manage: cardManage,
      posture_manage: postureManage,
      physical_manage: physicalManage,
    },
    identities: identities.data ?? [],
    credentials: credentials.data ?? [],
    devices: devices.data ?? [],
    postures: postures.data ?? [],
    zones: zones.data ?? [],
    grants: grants.data ?? [],
    events: events.data ?? [],
    disclaimer: "Digital and NFC credentials contain only opaque credential references. Device posture and physical access are separate controls from employment, payroll and application roles.",
  };
}

export async function issueOfficeIdentityCredential(input: { userId: string; kind: "DIGITAL_ID" | "NFC_CARD"; expiresAt?: string; metadata?: Record<string, unknown> }) {
  const current = await requireOfficePermission("identity.card.manage", { type: "COMPANY" });
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await current.admin.rpc("office_issue_identity_credential", {
    p_actor: current.identity.userId,
    p_user: input.userId,
    p_kind: input.kind,
    p_token_hash: digest(token),
    p_expires_at: input.expiresAt ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error || typeof data !== "string") throw new OfficeDeviceIdentityError(400, error?.message ?? "Unable to issue identity credential");
  return { credential_id: data, activation_token: token, shown_once: true };
}

export async function revokeOfficeIdentityCredential(input: { credentialId: string; reason: string }) {
  const current = await requireOfficePermission("identity.card.manage", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_revoke_identity_credential", {
    p_actor: current.identity.userId,
    p_credential: input.credentialId,
    p_reason: input.reason,
  });
  if (error || data !== true) throw new OfficeDeviceIdentityError(400, error?.message ?? "Unable to revoke identity credential");
  return { revoked: true };
}

export async function recordOfficeDevicePosture(input: {
  deviceId: string; osVersion?: string; encryption?: boolean; screenLock?: boolean; securityAgent?: boolean;
  patchCurrent?: boolean; firewall?: boolean; compromise?: boolean;
  status: "COMPLIANT" | "DEGRADED" | "NON_COMPLIANT" | "UNKNOWN";
  source: "KRAVIA_OFFICE" | "MDM" | "EDR" | "MANUAL_ATTESTATION" | "OTHER";
  details?: Record<string, unknown>;
}) {
  const current = await requireOfficePermission("device.posture.manage", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_record_device_posture", {
    p_actor: current.identity.userId,
    p_device: input.deviceId,
    p_os: input.osVersion?.trim() || null,
    p_encryption: input.encryption ?? null,
    p_screen_lock: input.screenLock ?? null,
    p_agent: input.securityAgent ?? null,
    p_patch: input.patchCurrent ?? null,
    p_firewall: input.firewall ?? null,
    p_compromise: input.compromise ?? false,
    p_status: input.status,
    p_source: input.source,
    p_details: input.details ?? {},
  });
  if (error || (typeof data !== "number" && typeof data !== "string")) throw new OfficeDeviceIdentityError(400, error?.message ?? "Unable to record device posture");
  return { posture_id: data };
}

export async function createOfficePhysicalAccessZone(input: { code: string; name: string; classification: string; description?: string }) {
  const current = await requireOfficePermission("physical.access.manage", { type: "COMPANY" });
  const payload = {
    zone_code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    classification: input.classification.trim().toUpperCase(),
    description: input.description?.trim() || null,
    created_by: current.identity.userId,
  };
  const { data, error } = await current.admin.from("office_physical_access_zones").insert(payload).select("id").single();
  if (error || !data) throw new OfficeDeviceIdentityError(400, error?.message ?? "Unable to create physical access zone");
  return { zone_id: data.id };
}

export async function grantOfficePhysicalAccess(input: { userId: string; zoneId: string; credentialId?: string; effectiveFrom?: string; effectiveTo?: string; reason: string }) {
  const current = await requireOfficePermission("physical.access.manage", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_grant_physical_access", {
    p_actor: current.identity.userId,
    p_user: input.userId,
    p_zone: input.zoneId,
    p_credential: input.credentialId ?? null,
    p_from: input.effectiveFrom ?? null,
    p_to: input.effectiveTo ?? null,
    p_reason: input.reason,
  });
  if (error || typeof data !== "string") throw new OfficeDeviceIdentityError(400, error?.message ?? "Unable to grant physical access");
  return { grant_id: data };
}

export async function revokeOfficePhysicalAccess(input: { grantId: string; reason: string }) {
  const current = await requireOfficePermission("physical.access.manage", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_revoke_physical_access", {
    p_actor: current.identity.userId,
    p_grant: input.grantId,
    p_reason: input.reason,
  });
  if (error || data !== true) throw new OfficeDeviceIdentityError(400, error?.message ?? "Unable to revoke physical access");
  return { revoked: true };
}
