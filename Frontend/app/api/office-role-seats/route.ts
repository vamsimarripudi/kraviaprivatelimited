import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { OfficePermissionError } from "@/lib/office/permission-engine";
import { changeOfficeRoleSeat, getOfficeRoleSeatPortfolio, OfficeRoleSeatError } from "@/lib/office/role-seat-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };
const uuid = z.string().uuid();
const scope = z.enum(["COMPANY", "DEPARTMENT", "TEAM", "PRODUCT", "PROJECT", "REPOSITORY", "COST_CENTER", "OWN"]);
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE"), code: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
    label: z.string().trim().min(3).max(120),
    position: z.string().min(2).max(80), department: z.string().min(2).max(60),
    description: z.string().max(2000).default(""),
    requires_department_handover: z.boolean().default(false),
  }).strict(),
  z.object({
    action: z.literal("GRANT"), seat_id: uuid,
    permission: z.string().min(3).max(160), scope_type: scope,
    scope_key: z.string().trim().min(1).max(200).nullable().optional(),
    exclusive: z.boolean().default(false),
  }).strict(),
  z.object({
    action: z.literal("REVIEW_GRANT"), grant_id: uuid, approve: z.boolean(),
    reason: z.string().trim().min(8).max(1000),
  }).strict(),
  z.object({
    action: z.literal("PROPOSE"), seat_id: uuid, recipient_id: uuid,
    reason: z.string().trim().min(12).max(2000),
  }).strict(),
  z.object({ action: z.literal("ACCEPT"), transfer_id: uuid }).strict(),
  z.object({
    action: z.literal("VERIFY_ITEM"), item_id: uuid,
    evidence: z.string().trim().min(8).max(1000),
  }).strict(),
  z.object({
    action: z.literal("FINALIZE"), transfer_id: uuid,
    evidence: z.string().trim().min(8).max(1000),
  }).strict(),
  z.object({
    action: z.literal("CANCEL"), transfer_id: uuid,
    reason: z.string().trim().min(8).max(1000),
  }).strict(),
]);

function failure(error: unknown) {
  const status = error instanceof OfficeRoleSeatError || error instanceof OfficePermissionError
    ? error.status : 503;
  return NextResponse.json({
    detail: error instanceof OfficeRoleSeatError || error instanceof OfficePermissionError
      ? error.message : "Role portfolio service unavailable",
  }, { status, headers: noStore });
}

export async function GET() {
  try {
    return NextResponse.json(await getOfficeRoleSeatPortfolio(), { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin role change rejected" }, { status: 403, headers: noStore });
  }
  const input = actionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ detail: "Invalid role-seat operation" }, { status: 400, headers: noStore });
  }
  try {
    return NextResponse.json(await changeOfficeRoleSeat(input.data), { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
