import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeActor, OfficePermissionError } from "@/lib/office/permission-engine";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const uuid = z.string().uuid();
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("PROPOSE"), department: z.string().min(2).max(40), recipient: uuid, reason: z.string().trim().min(12).max(1000) }),
  z.object({ action: z.literal("ACCEPT"), transfer_id: uuid }),
  z.object({ action: z.literal("CANCEL"), transfer_id: uuid }),
]);

export async function GET() {
  try {
    const { admin, identity } = await requireOfficeActor();
    const [departments, ownership, transfers, people] = await Promise.all([
      admin.from("office_department_catalog").select("code,label,active").eq("active", true).order("label"),
      admin.from("office_department_ownership").select("department_code,owner_user_id,previous_owner_user_id,version,updated_at"),
      admin.from("office_department_transfer_requests").select("id,department_code,from_owner_user_id,to_owner_user_id,reason,status,proposed_at,decided_at").order("proposed_at", { ascending: false }).limit(200),
      admin.from("office_identity_users").select("user_id,display_name,status").eq("status", "ACTIVE").order("display_name"),
    ]);
    if (departments.error || ownership.error || transfers.error || people.error) throw new Error("Ownership read unavailable");
    const founder = identity.roles.includes("OWNER");
    const owns = new Set((ownership.data ?? []).filter((row) => row.owner_user_id === identity.userId).map((row) => row.department_code));
    const visible = (transfers.data ?? []).filter((item) => founder || item.to_owner_user_id === identity.userId || item.from_owner_user_id === identity.userId);
    const departmentsToShow = (departments.data ?? []).filter((item) => founder || owns.has(item.code) || visible.some((transfer) => transfer.department_code === item.code));
    // Self-service recipients may see only the people participating in their
    // visible transfers, never the entire employee directory.
    const participantIds = new Set([identity.userId, ...visible.flatMap(item => [item.from_owner_user_id, item.to_owner_user_id])]);
    return NextResponse.json({
      actor: { user_id: identity.userId, founder },
      departments: departmentsToShow,
      ownership: (ownership.data ?? []).filter((item) => departmentsToShow.some((dept) => dept.code === item.department_code)),
      transfers: visible,
      people: founder || owns.size ? (people.data ?? []) : (people.data ?? []).filter(item => participantIds.has(item.user_id)),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof OfficePermissionError ? error.message : "Ownership data unavailable" }, { status: error instanceof OfficePermissionError ? error.status : 503 });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin handover is prohibited" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid handover request" }, { status: 400 });
  try {
    const { admin, identity } = await requireOfficeActor();
    const input = parsed.data;
    const result = input.action === "PROPOSE"
      ? await admin.rpc("office_department_transfer_propose", { p_actor: identity.userId, p_department: input.department, p_recipient: input.recipient, p_reason: input.reason })
      : await admin.rpc(input.action === "ACCEPT" ? "office_department_transfer_accept" : "office_department_transfer_cancel", { p_actor: identity.userId, p_transfer: input.transfer_id });
    if (result.error) return NextResponse.json({ detail: result.error.message }, { status: 409 });
    return NextResponse.json({ result: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof OfficePermissionError ? error.message : "Handover unavailable" }, { status: error instanceof OfficePermissionError ? error.status : 503 });
  }
}
