import { NextResponse } from "next/server";
import { z } from "zod";
import {
  approveReviewedFounderDevice,
  FounderDeviceReviewError,
  getFounderDeviceRecoveryOverview,
  submitFounderDeviceSecurityReview,
} from "@/lib/office/founder-device-review-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

const reviewSchema = z.object({
  action: z.literal("REVIEW"),
  device_id: z.string().uuid(),
  os_version: z.string().trim().min(3).max(120),
  encryption: z.literal(true),
  screen_lock: z.literal(true),
  security_agent: z.literal(true),
  patch_current: z.literal(true),
  firewall: z.literal(true),
  compromise: z.literal(false),
  company_managed: z.literal(true),
  management_evidence: z.string().trim().min(12).max(300),
  notes: z.string().trim().min(30).max(500),
}).strict();

const approveSchema = z.object({
  action: z.literal("APPROVE"),
  review_id: z.string().uuid(),
  reason: z.string().trim().min(20).max(500),
}).strict();

const schema = z.discriminatedUnion("action", [reviewSchema, approveSchema]);

function fail(error: unknown) {
  const status = error instanceof FounderDeviceReviewError ? error.status : 503;
  return NextResponse.json({
    detail: error instanceof FounderDeviceReviewError
      ? error.message : "Device recovery service is unavailable",
  }, { status, headers });
}

export async function GET() {
  try {
    return NextResponse.json(await getFounderDeviceRecoveryOverview(), { headers });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin device decisions are prohibited" }, { status: 403, headers });
  }
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ detail: "Complete the required independent security checks and evidence" }, { status: 400, headers });
  }
  try {
    if (input.data.action === "REVIEW") {
      const result = await submitFounderDeviceSecurityReview({
        deviceId: input.data.device_id,
        osVersion: input.data.os_version,
        encryption: input.data.encryption,
        screenLock: input.data.screen_lock,
        securityAgent: input.data.security_agent,
        patchCurrent: input.data.patch_current,
        firewall: input.data.firewall,
        compromise: input.data.compromise,
        companyManaged: input.data.company_managed,
        managementEvidence: input.data.management_evidence,
        notes: input.data.notes,
      });
      return NextResponse.json(result, { status: 201, headers });
    }
    return NextResponse.json(await approveReviewedFounderDevice({
      reviewId: input.data.review_id,
      reason: input.data.reason,
    }), { headers });
  } catch (error) {
    return fail(error);
  }
}
