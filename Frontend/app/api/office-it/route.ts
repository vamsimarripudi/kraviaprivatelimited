import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assignSoftwareLicense,
  createItTicket,
  createSoftwareLicense,
  getOfficeItOverview,
  OfficeItError,
  revokeSoftwareLicense,
  transitionItTicket,
} from "@/lib/office/it-service-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_TICKET"), category: z.enum(["DEVICE","SOFTWARE","ACCESS","EMAIL","MFA","NETWORK","VPN","PRINTER","SECURITY","OTHER"]), priority: z.enum(["LOW","NORMAL","HIGH","URGENT"]), title: z.string().trim().min(3).max(180), description: z.string().trim().min(3).max(5000), device_id: z.string().uuid().optional(), due_at: z.string().datetime({ offset: true }).optional() }),
  z.object({ action: z.literal("TRANSITION_TICKET"), ticket_id: z.string().uuid(), status: z.enum(["OPEN","TRIAGED","IN_PROGRESS","WAITING_USER","WAITING_VENDOR","RESOLVED","CLOSED","CANCELLED"]), owner_user_id: z.string().uuid().optional(), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("CREATE_LICENSE"), owner_user_id: z.string().uuid(), vendor: z.string().trim().min(2).max(160), product: z.string().trim().min(2).max(160), plan: z.string().trim().max(160).optional(), cycle: z.enum(["MONTHLY","ANNUAL","MULTI_YEAR","PERPETUAL","USAGE"]).optional(), seats: z.number().int().min(0).max(100000).optional(), currency: z.string().trim().length(3).optional(), cost_minor: z.number().int().min(0).optional(), renewal_at: z.string().datetime({ offset: true }).optional(), notice_at: z.string().datetime({ offset: true }).optional(), auto_renew: z.boolean().optional(), contract_reference: z.string().trim().max(220).optional(), procurement_reference: z.string().trim().max(220).optional() }),
  z.object({ action: z.literal("ASSIGN_LICENSE"), license_id: z.string().uuid(), user_id: z.string().uuid(), external_reference: z.string().trim().max(220).optional(), expires_at: z.string().datetime({ offset: true }).optional() }),
  z.object({ action: z.literal("REVOKE_LICENSE"), assignment_id: z.string().uuid(), reason: z.string().trim().min(3).max(500) }),
]);

function failure(error: unknown, fallback: string) {
  const status = error instanceof OfficeItError ? error.status : 500;
  const detail = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    return NextResponse.json(await getOfficeItOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, "Unable to load IT service desk");
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin IT mutation is not allowed" }, { status: 403 });
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid IT service action" }, { status: 400 });
  try {
    const input = parsed.data;
    if (input.action === "CREATE_TICKET") return NextResponse.json(await createItTicket({ category: input.category, priority: input.priority, title: input.title, description: input.description, deviceId: input.device_id, dueAt: input.due_at }), { status: 201 });
    if (input.action === "TRANSITION_TICKET") return NextResponse.json(await transitionItTicket({ ticketId: input.ticket_id, status: input.status, ownerUserId: input.owner_user_id, note: input.note }));
    if (input.action === "CREATE_LICENSE") return NextResponse.json(await createSoftwareLicense({ ownerUserId: input.owner_user_id, vendor: input.vendor, product: input.product, plan: input.plan, cycle: input.cycle, seats: input.seats, currency: input.currency, costMinor: input.cost_minor, renewalAt: input.renewal_at, noticeAt: input.notice_at, autoRenew: input.auto_renew, contractReference: input.contract_reference, procurementReference: input.procurement_reference }), { status: 201 });
    if (input.action === "ASSIGN_LICENSE") return NextResponse.json(await assignSoftwareLicense({ licenseId: input.license_id, userId: input.user_id, externalReference: input.external_reference, expiresAt: input.expires_at }), { status: 201 });
    return NextResponse.json(await revokeSoftwareLicense({ assignmentId: input.assignment_id, reason: input.reason }));
  } catch (error) {
    return failure(error, "IT service action failed");
  }
}
