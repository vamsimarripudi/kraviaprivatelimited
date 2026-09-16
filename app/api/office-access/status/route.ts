import { NextResponse } from "next/server";
import { z } from "zod";
import { changeOfficeIdentityStatus, OfficeAccessError } from "@/lib/office/access-admin";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const statusSchema = z.object({
  target_user_id: z.string().uuid(),
  status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin Office access change is not allowed" }, { status: 403 });
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid identity-status request" }, { status: 400 });
  try {
    const result = await changeOfficeIdentityStatus({ targetUserId: parsed.data.target_user_id, status: parsed.data.status, reason: parsed.data.reason });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OfficeAccessError) return NextResponse.json({ detail: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ detail: "Identity status change failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
