import { NextResponse } from "next/server";
import { z } from "zod";
import { OfficeAccessError } from "@/lib/office/access-admin";
import { resetOfficeMfa } from "@/lib/office/access-recovery";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.object({ target_user_id: z.string().uuid(), reason: z.string().trim().min(3).max(500) });
export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin Office access change is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid MFA-reset request" }, { status: 400 });
  try { return NextResponse.json(await resetOfficeMfa({ targetUserId: parsed.data.target_user_id, reason: parsed.data.reason }), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { if (error instanceof OfficeAccessError) return NextResponse.json({ detail: error.message }, { status: error.status }); return NextResponse.json({ detail: "MFA reset failed" }, { status: 500 }); }
}
