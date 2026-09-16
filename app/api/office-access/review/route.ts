import { NextResponse } from "next/server";
import { z } from "zod";
import { OfficeAccessError, reviewOfficeAccess } from "@/lib/office/access-admin";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const reviewSchema = z.object({
  target_user_id: z.string().uuid(),
  decision: z.enum(["APPROVED", "CHANGES_REQUIRED"]),
  notes: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin Office access review is not allowed" }, { status: 403 });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid access-review request" }, { status: 400 });
  try {
    const result = await reviewOfficeAccess({ targetUserId: parsed.data.target_user_id, decision: parsed.data.decision, notes: parsed.data.notes });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OfficeAccessError) return NextResponse.json({ detail: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ detail: "Access review failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
