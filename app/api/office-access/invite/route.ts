import { NextResponse } from "next/server";
import { z } from "zod";
import { inviteOfficeUser, OfficeAccessError } from "@/lib/office/access-admin";
import { officeDepartments } from "@/lib/office/access-policy";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { officeRoles } from "@/lib/office/workspaces";

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  display_name: z.string().trim().min(1).max(120).optional(),
  job_title: z.string().trim().min(1).max(120).optional(),
  department: z.enum(officeDepartments),
  roles: z.array(z.enum(officeRoles)).min(1).max(6),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin Office access change is not allowed" }, { status: 403 });
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid Office invitation request" }, { status: 400 });

  try {
    const result = await inviteOfficeUser({
      email: parsed.data.email,
      displayName: parsed.data.display_name,
      jobTitle: parsed.data.job_title,
      department: parsed.data.department,
      roles: parsed.data.roles,
      reason: parsed.data.reason,
      origin: new URL(request.url).origin,
    });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OfficeAccessError) return NextResponse.json({ detail: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ detail: "Office invitation failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
