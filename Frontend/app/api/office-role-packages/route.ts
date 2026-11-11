import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { changeRolePackage, getRolePackageWorkspace, OfficeRolePackageError } from "@/lib/office/role-package-server";

export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const responsibilities = z.array(z.string().trim().min(3).max(300)).max(30);
const scope = z.enum(["DEPARTMENT","TEAM","PRODUCT","PROJECT","REPOSITORY","COST_CENTER","COMPANY","OWN"]);
const scopes = z.array(z.object({
  profile_code: z.string().trim().min(2).max(100),
  scope_type: scope,
  scope_key: z.string().trim().max(240).optional(),
})).max(16);
const additional = z.array(z.object({
  position_code: z.string().trim().min(2).max(100),
  department_code: z.string().trim().min(2).max(100),
  responsibilities: responsibilities.optional(),
})).max(16);
const steps = z.array(z.object({
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,59}$/),
  label: z.string().trim().min(3).max(180),
  required: z.boolean(),
})).max(24);
const draft = z.object({
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,59}$/),
  label: z.string().trim().min(3).max(140),
  description: z.string().trim().max(2000),
  department: z.string().trim().min(2).max(100),
  position: z.string().trim().min(2).max(100),
  employmentType: z.enum(["EMPLOYEE","CONTRACTOR","INTERN","TRAINEE","ADVISOR","PROFESSIONAL"]),
  responsibilities,
  additionalRoles: additional,
  profiles: scopes,
  steps,
  workPattern: z.object({
    days: z.array(z.enum(["MON","TUE","WED","THU","FRI","SAT","SUN"])).min(1).max(7),
    daily_minutes: z.number().int().min(60).max(600),
    weekly_minutes: z.number().int().min(60).max(2880),
    flexible: z.boolean(),
    time_zone: z.literal("Asia/Kolkata"),
  }),
});
const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE"), draft }),
  z.object({ action: z.literal("PUBLISH"), packageId: uuid }),
  z.object({ action: z.literal("APPLY"), packageId: uuid, employeeId: uuid,
    reason: z.string().trim().min(12).max(500) }),
  z.object({ action: z.literal("TASK"), taskId: uuid,
    decision: z.enum(["SUBMIT","VERIFY","RETURN","WAIVE"]),
    reference: z.string().trim().max(500).optional(), note: z.string().trim().max(500).optional() }),
]);

function fail(e: unknown) {
  const status = e instanceof OfficeRolePackageError ? e.status : 500;
  return NextResponse.json({ detail: e instanceof OfficeRolePackageError
    ? e.message : "Reusable role package service unavailable" },
    { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("employee");
  if (target && !uuid.safeParse(target).success) {
    return NextResponse.json({ detail: "Invalid employee identity" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getRolePackageWorkspace(target ?? undefined),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return fail(e); }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin workforce mutation rejected" }, { status: 403 });
  }
  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ detail: "Invalid reusable role package request" }, { status: 400 });
  }
  try {
    return NextResponse.json(await changeRolePackage(parsed.data),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return fail(e); }
}
