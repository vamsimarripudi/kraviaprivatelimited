import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  getAssignedDocumentApprovals, requestDocumentApprovalOtp,
  approveDocumentWithOtp, OfficeDocumentOtpError,
} from "@/lib/office/document-otp-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store", "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;
const uuid = z.string().uuid();
const location = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy_m: z.number().finite().positive().max(5000),
  captured_at: z.string().datetime({ offset: true }),
}).strict();
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("REQUEST"),
    instance_id: uuid, render_id: uuid,
  }).strict(),
  z.object({
    action: z.literal("VERIFY"),
    instance_id: uuid, render_id: uuid, challenge_id: uuid,
    code: z.string().regex(/^\d{6}$/),
    location,
  }).strict(),
]);

function failure(error: unknown) {
  const status = error instanceof OfficeDocumentOtpError ? error.status : 503;
  return NextResponse.json({
    detail: error instanceof OfficeDocumentOtpError
      ? error.message : "Private document OTP service unavailable",
  }, { status, headers });
}

export async function GET() {
  try {
    return NextResponse.json(await getAssignedDocumentApprovals(), { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request))
    return NextResponse.json({ detail: "Cross-origin document approval is prohibited" }, {
      status: 403, headers,
    });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ detail: "Invalid document OTP request or location evidence" }, {
      status: 400, headers,
    });
  try {
    if (parsed.data.action === "REQUEST")
      return NextResponse.json(await requestDocumentApprovalOtp(
        parsed.data.instance_id, parsed.data.render_id,
      ), { status: 201, headers });
    return NextResponse.json(await approveDocumentWithOtp({
      challengeId: parsed.data.challenge_id,
      instanceId: parsed.data.instance_id,
      renderId: parsed.data.render_id,
      code: parsed.data.code,
      latitude: parsed.data.location.latitude,
      longitude: parsed.data.location.longitude,
      accuracyM: parsed.data.location.accuracy_m,
      capturedAt: parsed.data.location.captured_at,
    }), { headers });
  } catch (error) { return failure(error); }
}
