import { NextResponse } from "next/server";
import { z } from "zod";
import { OfficeAccessError } from "@/lib/office/access-admin";
import { issueOfficePasswordRecovery } from "@/lib/office/access-recovery";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.object({
  target_user_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Office recovery action is not allowed" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ detail: "Invalid password-recovery request" }, { status: 400 });
  }
  try {
    const result = await issueOfficePasswordRecovery({
      targetUserId: parsed.data.target_user_id,
      reason: parsed.data.reason,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OfficeAccessError) {
      return NextResponse.json({ detail: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ detail: "Password recovery link issuance failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
