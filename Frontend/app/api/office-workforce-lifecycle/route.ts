import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  createOfficeWorkforceLifecycleRequest,
  executeOfficeWorkforceOffboarding,
  getOfficeWorkforceLifecycle,
  OfficeWorkforceLifecycleError,
} from "@/lib/office/workforce-lifecycle-server";

const reason = z.string().trim().min(3).max(1000);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_LIFECYCLE"), target_user_id: z.string().uuid(), kind: z.enum(["ONBOARDING", "OFFBOARDING"]), reason }),
  z.object({ action: z.literal("EXECUTE_OFFBOARDING"), target_user_id: z.string().uuid(), request_id: z.string().uuid(), reason }),
]);

export async function GET() {
  try {
    return NextResponse.json(await getOfficeWorkforceLifecycle(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeWorkforceLifecycleError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load workforce lifecycle";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin workforce lifecycle mutation is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid workforce lifecycle request" }, { status: 400 });
  try {
    const result = parsed.data.action === "CREATE_LIFECYCLE"
      ? await createOfficeWorkforceLifecycleRequest({ targetUserId: parsed.data.target_user_id, kind: parsed.data.kind, reason: parsed.data.reason })
      : await executeOfficeWorkforceOffboarding({ targetUserId: parsed.data.target_user_id, requestId: parsed.data.request_id, reason: parsed.data.reason });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeWorkforceLifecycleError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to update workforce lifecycle";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
