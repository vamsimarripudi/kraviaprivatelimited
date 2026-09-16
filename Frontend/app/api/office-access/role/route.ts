import { NextResponse } from "next/server";
import { z } from "zod";
import { changeOfficeRole, OfficeAccessError } from "@/lib/office/access-admin";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { officeRoles } from "@/lib/office/workspaces";

const roleSchema = z.object({
  target_user_id: z.string().uuid(),
  role: z.enum(officeRoles),
  action: z.enum(["GRANT", "REVOKE"]),
  expires_at: z.string().datetime({ offset: true }).optional(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin Office access change is not allowed" }, { status: 403 });
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid role-change request" }, { status: 400 });
  try {
    const result = await changeOfficeRole({
      targetUserId: parsed.data.target_user_id,
      role: parsed.data.role,
      action: parsed.data.action,
      expiresAt: parsed.data.expires_at,
      reason: parsed.data.reason,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OfficeAccessError) return NextResponse.json({ detail: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ detail: "Role change failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
