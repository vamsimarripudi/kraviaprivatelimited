import { NextResponse } from "next/server";
import { z } from "zod";
import {
  bookOfficeRoom,
  createOfficeRoom,
  createOfficeSite,
  cancelOfficeRoom,
  checkInOfficeVisitor,
  checkOutOfficeVisitor,
  getPhysicalOfficeOverview,
  inviteOfficeVisitor,
  issueOfficeVisitorCredential,
  OfficeFacilitiesError,
  reportFacilityIssue,
  reviewOfficeVisitor,
  transitionFacilityIssue,
  updateOfficeRoom,
  updateOfficeSite,
} from "@/lib/office/facilities-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_SITE"), code: z.string().trim().min(2).max(32), name: z.string().trim().min(2).max(180), address: z.string().trim().max(500).optional(), timezone: z.string().trim().min(3).max(80).optional() }),
  z.object({ action: z.literal("UPDATE_SITE"), site_id: z.string().uuid(), name: z.string().trim().min(2).max(180), address: z.string().trim().max(500).optional(), timezone: z.string().trim().min(3).max(80), status: z.enum(["ACTIVE","INACTIVE","CLOSED"]) }),
  z.object({ action: z.literal("CREATE_ROOM"), site_id: z.string().uuid(), code: z.string().trim().min(2).max(32), name: z.string().trim().min(2).max(180), room_type: z.enum(["MEETING","BOARD","INTERVIEW","TRAINING","FOCUS","OTHER"]), capacity: z.number().int().min(1).max(500), zone_id: z.string().uuid().optional() }),
  z.object({ action: z.literal("UPDATE_ROOM"), room_id: z.string().uuid(), name: z.string().trim().min(2).max(180), room_type: z.enum(["MEETING","BOARD","INTERVIEW","TRAINING","FOCUS","OTHER"]), capacity: z.number().int().min(1).max(500), zone_id: z.string().uuid().optional(), status: z.enum(["ACTIVE","MAINTENANCE","INACTIVE"]) }),
  z.object({ action: z.literal("BOOK_ROOM"), room_id: z.string().uuid(), title: z.string().trim().min(2).max(180), purpose: z.string().trim().max(1000).optional(), visibility: z.enum(["INTERNAL","CONFIDENTIAL"]).optional(), starts_at: z.string().datetime({ offset: true }), ends_at: z.string().datetime({ offset: true }) }),
  z.object({ action: z.literal("CANCEL_BOOKING"), booking_id: z.string().uuid(), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("INVITE_VISITOR"), site_id: z.string().uuid(), name: z.string().trim().min(2).max(180), email: z.string().email().max(320).optional(), phone: z.string().trim().max(40).optional(), organization: z.string().trim().max(180).optional(), purpose: z.string().trim().min(3).max(1000), starts_at: z.string().datetime({ offset: true }), ends_at: z.string().datetime({ offset: true }) }),
  z.object({ action: z.literal("REVIEW_VISITOR"), visitor_id: z.string().uuid(), decision: z.enum(["APPROVED","DENIED"]), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("ISSUE_VISITOR_CREDENTIAL"), visitor_id: z.string().uuid(), expires_at: z.string().datetime({ offset: true }).optional() }),
  z.object({ action: z.literal("CHECK_IN_VISITOR"), visitor_id: z.string().uuid() }),
  z.object({ action: z.literal("CHECK_OUT_VISITOR"), visitor_id: z.string().uuid() }),
  z.object({ action: z.literal("REPORT_FACILITY_ISSUE"), site_id: z.string().uuid(), room_id: z.string().uuid().optional(), category: z.enum(["POWER","HVAC","CLEANING","SAFETY","SECURITY","ACCESS","FURNITURE","WATER","OTHER"]), priority: z.enum(["LOW","NORMAL","HIGH","URGENT"]), title: z.string().trim().min(3).max(180), description: z.string().trim().min(3).max(5000) }),
  z.object({ action: z.literal("TRANSITION_FACILITY_ISSUE"), incident_id: z.string().uuid(), status: z.enum(["OPEN","TRIAGED","IN_PROGRESS","WAITING_VENDOR","RESOLVED","CLOSED","CANCELLED"]), owner_user_id: z.string().uuid().optional(), note: z.string().trim().max(1000).optional() }),
]);

function failure(error: unknown, fallback: string) {
  const status = error instanceof OfficeFacilitiesError ? error.status : 500;
  const detail = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    return NextResponse.json(await getPhysicalOfficeOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, "Unable to load physical office operations");
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin facilities mutation is not allowed" }, { status: 403 });
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid physical office action" }, { status: 400 });
  try {
    const input = parsed.data;
    if (input.action === "CREATE_SITE") return NextResponse.json(await createOfficeSite({ code: input.code, name: input.name, address: input.address, timezone: input.timezone }), { status: 201 });
    if (input.action === "UPDATE_SITE") return NextResponse.json(await updateOfficeSite({ siteId: input.site_id, name: input.name, address: input.address, timezone: input.timezone, status: input.status }));
    if (input.action === "CREATE_ROOM") return NextResponse.json(await createOfficeRoom({ siteId: input.site_id, code: input.code, name: input.name, roomType: input.room_type, capacity: input.capacity, zoneId: input.zone_id }), { status: 201 });
    if (input.action === "UPDATE_ROOM") return NextResponse.json(await updateOfficeRoom({ roomId: input.room_id, name: input.name, roomType: input.room_type, capacity: input.capacity, zoneId: input.zone_id, status: input.status }));
    if (input.action === "BOOK_ROOM") return NextResponse.json(await bookOfficeRoom({ roomId: input.room_id, title: input.title, purpose: input.purpose, visibility: input.visibility, startsAt: input.starts_at, endsAt: input.ends_at }), { status: 201 });
    if (input.action === "CANCEL_BOOKING") return NextResponse.json(await cancelOfficeRoom({ bookingId: input.booking_id, reason: input.reason }));
    if (input.action === "INVITE_VISITOR") return NextResponse.json(await inviteOfficeVisitor({ siteId: input.site_id, name: input.name, email: input.email, phone: input.phone, organization: input.organization, purpose: input.purpose, startsAt: input.starts_at, endsAt: input.ends_at }), { status: 201 });
    if (input.action === "REVIEW_VISITOR") return NextResponse.json(await reviewOfficeVisitor({ visitorId: input.visitor_id, decision: input.decision, note: input.note }));
    if (input.action === "ISSUE_VISITOR_CREDENTIAL") return NextResponse.json(await issueOfficeVisitorCredential({ visitorId: input.visitor_id, expiresAt: input.expires_at }), { status: 201 });
    if (input.action === "CHECK_IN_VISITOR") return NextResponse.json(await checkInOfficeVisitor(input.visitor_id));
    if (input.action === "CHECK_OUT_VISITOR") return NextResponse.json(await checkOutOfficeVisitor(input.visitor_id));
    if (input.action === "REPORT_FACILITY_ISSUE") return NextResponse.json(await reportFacilityIssue({ siteId: input.site_id, roomId: input.room_id, category: input.category, priority: input.priority, title: input.title, description: input.description }), { status: 201 });
    return NextResponse.json(await transitionFacilityIssue({ incidentId: input.incident_id, status: input.status, ownerUserId: input.owner_user_id, note: input.note }));
  } catch (error) {
    return failure(error, "Physical office action failed");
  }
}
