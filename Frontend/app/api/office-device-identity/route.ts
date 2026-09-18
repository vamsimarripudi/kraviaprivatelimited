import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createOfficePhysicalAccessZone,
  getOfficeDeviceIdentityOverview,
  grantOfficePhysicalAccess,
  issueOfficeIdentityCredential,
  OfficeDeviceIdentityError,
  recordOfficeDevicePosture,
  revokeOfficeIdentityCredential,
  revokeOfficePhysicalAccess,
} from "@/lib/office/device-identity-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const issueSchema = z.object({
  action: z.literal("ISSUE_CREDENTIAL"),
  user_id: z.string().uuid(),
  kind: z.enum(["DIGITAL_ID", "NFC_CARD"]),
  expires_at: z.string().datetime({ offset: true }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const revokeCredentialSchema = z.object({
  action: z.literal("REVOKE_CREDENTIAL"),
  credential_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});
const postureSchema = z.object({
  action: z.literal("RECORD_POSTURE"),
  device_id: z.string().uuid(),
  os_version: z.string().trim().max(120).optional(),
  encryption: z.boolean().optional(),
  screen_lock: z.boolean().optional(),
  security_agent: z.boolean().optional(),
  patch_current: z.boolean().optional(),
  firewall: z.boolean().optional(),
  compromise: z.boolean().optional(),
  status: z.enum(["COMPLIANT", "DEGRADED", "NON_COMPLIANT", "UNKNOWN"]),
  source: z.enum(["KRAVIA_OFFICE", "MDM", "EDR", "MANUAL_ATTESTATION", "OTHER"]),
  details: z.record(z.string(), z.unknown()).optional(),
});
const zoneSchema = z.object({
  action: z.literal("CREATE_ZONE"),
  code: z.string().trim().min(2).max(50).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(120),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "CRITICAL"]),
  description: z.string().trim().max(500).optional(),
});
const grantSchema = z.object({
  action: z.literal("GRANT_ZONE"),
  user_id: z.string().uuid(),
  zone_id: z.string().uuid(),
  credential_id: z.string().uuid().optional(),
  effective_from: z.string().datetime({ offset: true }).optional(),
  effective_to: z.string().datetime({ offset: true }).optional(),
  reason: z.string().trim().min(3).max(500),
});
const revokeGrantSchema = z.object({
  action: z.literal("REVOKE_ZONE"),
  grant_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});
const mutationSchema = z.discriminatedUnion("action", [
  issueSchema,
  revokeCredentialSchema,
  postureSchema,
  zoneSchema,
  grantSchema,
  revokeGrantSchema,
]);

function responseError(error: unknown, fallback: string) {
  const status = error instanceof OfficeDeviceIdentityError ? error.status : 500;
  const detail = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    return NextResponse.json(await getOfficeDeviceIdentityOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return responseError(error, "Unable to load identity and device controls");
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin identity/device mutation is not allowed" }, { status: 403 });
  }
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid identity/device action" }, { status: 400 });
  try {
    const input = parsed.data;
    if (input.action === "ISSUE_CREDENTIAL") {
      return NextResponse.json(await issueOfficeIdentityCredential({
        userId: input.user_id,
        kind: input.kind,
        expiresAt: input.expires_at,
        metadata: input.metadata,
      }), { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (input.action === "REVOKE_CREDENTIAL") {
      return NextResponse.json(await revokeOfficeIdentityCredential({ credentialId: input.credential_id, reason: input.reason }), { headers: { "Cache-Control": "no-store" } });
    }
    if (input.action === "RECORD_POSTURE") {
      return NextResponse.json(await recordOfficeDevicePosture({
        deviceId: input.device_id,
        osVersion: input.os_version,
        encryption: input.encryption,
        screenLock: input.screen_lock,
        securityAgent: input.security_agent,
        patchCurrent: input.patch_current,
        firewall: input.firewall,
        compromise: input.compromise,
        status: input.status,
        source: input.source,
        details: input.details,
      }), { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (input.action === "CREATE_ZONE") {
      return NextResponse.json(await createOfficePhysicalAccessZone({
        code: input.code,
        name: input.name,
        classification: input.classification,
        description: input.description,
      }), { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (input.action === "GRANT_ZONE") {
      return NextResponse.json(await grantOfficePhysicalAccess({
        userId: input.user_id,
        zoneId: input.zone_id,
        credentialId: input.credential_id,
        effectiveFrom: input.effective_from,
        effectiveTo: input.effective_to,
        reason: input.reason,
      }), { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(await revokeOfficePhysicalAccess({ grantId: input.grant_id, reason: input.reason }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return responseError(error, "Identity/device action failed");
  }
}
