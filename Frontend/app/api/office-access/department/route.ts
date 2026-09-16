import { NextResponse } from "next/server";
import { z } from "zod";
import { OfficeAccessError } from "@/lib/office/access-admin";
import { changeOfficeDepartment } from "@/lib/office/access-recovery";
import { officeDepartments } from "@/lib/office/access-policy";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.object({ target_user_id: z.string().uuid(), department: z.enum(officeDepartments), reason: z.string().trim().min(3).max(500) });
export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin Office access change is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid department-change request" }, { status: 400 });
  try { return NextResponse.json(await changeOfficeDepartment({ targetUserId: parsed.data.target_user_id, department: parsed.data.department, reason: parsed.data.reason }), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { if (error instanceof OfficeAccessError) return NextResponse.json({ detail: error.message }, { status: error.status }); return NextResponse.json({ detail: "Department change failed" }, { status: 500 }); }
}
