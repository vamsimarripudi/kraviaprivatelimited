import "server-only";

import { createHash, randomBytes } from "node:crypto";
import {
  OfficePermissionError,
  requireOfficeActor,
  requireOfficePermission,
  resolveOfficePermission,
} from "@/lib/office/permission-engine";

export class OfficeFacilitiesError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeFacilitiesError";
  }
}

type Actor = Awaited<ReturnType<typeof requireOfficeActor>>;

async function actor(): Promise<Actor> {
  try { return await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeFacilitiesError(error.status, error.message);
    throw error;
  }
}

async function can(current: Actor, permission: string) {
  return (await resolveOfficePermission(current.admin, current.identity, permission, { type: "COMPANY" })).allowed;
}

function assert(error: { message?: string } | null, message: string) {
  if (error) throw new OfficeFacilitiesError(503, error.message || message);
}

export async function getPhysicalOfficeOverview() {
  const current = await actor();
  const [roomRead, roomBook, visitorInvite, visitorManage, issueReport, facilitiesManage] = await Promise.all([
    can(current, "facilities.room.read"),
    can(current, "facilities.room.book"),
    can(current, "visitor.invite"),
    can(current, "visitor.manage"),
    can(current, "facilities.issue.report"),
    can(current, "facilities.manage"),
  ]);
  if (!roomRead && !visitorInvite && !issueReport && !facilitiesManage && !visitorManage) {
    throw new OfficeFacilitiesError(403, "Physical Office is not assigned to your current authority");
  }

  const [sitesResult, roomsResult, identitiesResult] = await Promise.all([
    current.admin.from("office_facility_sites").select("id,site_code,name,address_text,timezone_name,status").eq("status", "ACTIVE").order("name"),
    current.admin.from("office_facility_rooms").select("id,site_id,room_code,name,room_type,capacity,physical_zone_id,status").order("name"),
    visitorManage || facilitiesManage
      ? current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status", "ACTIVE").order("display_name")
      : Promise.resolve({ data: [], error: null }),
  ]);
  assert(sitesResult.error, "Office sites are temporarily unavailable");
  assert(roomsResult.error, "Office rooms are temporarily unavailable");
  assert(identitiesResult.error, "Office identities are temporarily unavailable");

  let bookings = current.admin.from("office_room_bookings")
    .select("id,room_id,organizer_user_id,title,purpose,visibility,starts_at,ends_at,status,cancelled_at,cancellation_reason,created_at,updated_at")
    .gte("ends_at", new Date(Date.now() - 86_400_000).toISOString())
    .order("starts_at", { ascending: true }).limit(500);
  if (!facilitiesManage) bookings = bookings.or(`organizer_user_id.eq.${current.identity.userId},visibility.eq.INTERNAL`);
  const bookingResult = await bookings;
  assert(bookingResult.error, "Room bookings are temporarily unavailable");
  const safeBookings = (bookingResult.data ?? []).map((row) => row.organizer_user_id === current.identity.userId || facilitiesManage
    ? row
    : { ...row, title: "Reserved", purpose: null });

  let visitors = current.admin.from("office_visitors")
    .select("id,visitor_code,site_id,host_user_id,full_name,email,phone,organization,purpose,scheduled_from,scheduled_to,status,reviewed_by,reviewed_at,review_note,checked_in_at,checked_out_at,created_at,updated_at")
    .gte("scheduled_to", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order("scheduled_from", { ascending: false }).limit(500);
  if (!visitorManage) visitors = visitors.eq("host_user_id", current.identity.userId);
  const visitorResult = await visitors;
  assert(visitorResult.error, "Visitor records are temporarily unavailable");

  let incidents = current.admin.from("office_facility_incidents")
    .select("id,site_id,room_id,reporter_user_id,owner_user_id,category,priority,title,description,status,resolution,due_at,resolved_at,closed_at,created_at,updated_at")
    .order("created_at", { ascending: false }).limit(500);
  if (!facilitiesManage) incidents = incidents.eq("reporter_user_id", current.identity.userId);
  const incidentResult = await incidents;
  assert(incidentResult.error, "Facility incidents are temporarily unavailable");

  const credentials = visitorManage
    ? await current.admin.from("office_visitor_credentials").select("id,visitor_id,status,issued_by,issued_at,expires_at,revoked_by,revoked_at").order("issued_at", { ascending: false }).limit(500)
    : { data: [], error: null };
  assert(credentials.error, "Visitor credentials are temporarily unavailable");

  return {
    actor: { user_id: current.identity.userId, roles: current.identity.roles, department: current.identity.department ?? null },
    capabilities: {
      room_read: roomRead,
      room_book: roomBook,
      visitor_invite: visitorInvite,
      visitor_manage: visitorManage,
      issue_report: issueReport,
      facilities_manage: facilitiesManage,
    },
    sites: sitesResult.data ?? [],
    rooms: roomsResult.data ?? [],
    bookings: safeBookings,
    visitors: visitorResult.data ?? [],
    incidents: incidentResult.data ?? [],
    identities: identitiesResult.data ?? [],
    credentials: credentials.data ?? [],
    disclaimer: "KRAVIA stores visitor credential hashes only. Room booking does not grant physical-zone access, and visitor approval does not grant employee or application access.",
  };
}

export async function bookOfficeRoom(input: { roomId: string; title: string; purpose?: string; visibility?: string; startsAt: string; endsAt: string }) {
  const current = await requireOfficePermission("facilities.room.book", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_room_book", {
    p_actor: current.identity.userId,
    p_room: input.roomId,
    p_title: input.title,
    p_purpose: input.purpose?.trim() || null,
    p_visibility: input.visibility ?? "INTERNAL",
    p_start: input.startsAt,
    p_end: input.endsAt,
  });
  if (error || typeof data !== "string") throw new OfficeFacilitiesError(400, error?.message ?? "Unable to book room");
  return { booking_id: data };
}

export async function cancelOfficeRoom(input: { bookingId: string; reason: string }) {
  const current = await actor();
  const { data, error } = await current.admin.rpc("office_room_cancel", {
    p_actor: current.identity.userId,
    p_booking: input.bookingId,
    p_reason: input.reason,
  });
  if (error || data !== true) throw new OfficeFacilitiesError(400, error?.message ?? "Unable to cancel room booking");
  return { cancelled: true };
}

export async function inviteOfficeVisitor(input: { siteId: string; name: string; email?: string; phone?: string; organization?: string; purpose: string; startsAt: string; endsAt: string }) {
  const current = await requireOfficePermission("visitor.invite", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_visitor_invite", {
    p_actor: current.identity.userId,
    p_site: input.siteId,
    p_name: input.name,
    p_email: input.email?.trim() || null,
    p_phone: input.phone?.trim() || null,
    p_organization: input.organization?.trim() || null,
    p_purpose: input.purpose,
    p_from: input.startsAt,
    p_to: input.endsAt,
  });
  if (error || typeof data !== "string") throw new OfficeFacilitiesError(400, error?.message ?? "Unable to invite visitor");
  return { visitor_id: data };
}

export async function reviewOfficeVisitor(input: { visitorId: string; decision: "APPROVED" | "DENIED"; note?: string }) {
  const current = await requireOfficePermission("visitor.manage", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_visitor_review", {
    p_actor: current.identity.userId,
    p_visitor: input.visitorId,
    p_decision: input.decision,
    p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeFacilitiesError(400, error?.message ?? "Unable to review visitor");
  return { status: data };
}

export async function issueOfficeVisitorCredential(input: { visitorId: string; expiresAt?: string }) {
  const current = await requireOfficePermission("visitor.manage", { type: "COMPANY" });
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const expires = input.expiresAt ?? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const { data, error } = await current.admin.rpc("office_visitor_issue_credential", {
    p_actor: current.identity.userId,
    p_visitor: input.visitorId,
    p_token_hash: hash,
    p_expires: expires,
  });
  if (error || typeof data !== "string") throw new OfficeFacilitiesError(400, error?.message ?? "Unable to issue visitor credential");
  return { credential_id: data, credential_token: token, display_once: true };
}

export async function checkInOfficeVisitor(visitorId: string) {
  const current = await requireOfficePermission("visitor.manage", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_visitor_checkin", { p_actor: current.identity.userId, p_visitor: visitorId });
  if (error || typeof data !== "string") throw new OfficeFacilitiesError(400, error?.message ?? "Unable to check in visitor");
  return { status: data };
}

export async function checkOutOfficeVisitor(visitorId: string) {
  const current = await requireOfficePermission("visitor.manage", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_visitor_checkout", { p_actor: current.identity.userId, p_visitor: visitorId });
  if (error || typeof data !== "string") throw new OfficeFacilitiesError(400, error?.message ?? "Unable to check out visitor");
  return { status: data };
}

export async function reportFacilityIssue(input: { siteId: string; roomId?: string; category: string; priority: string; title: string; description: string }) {
  const current = await requireOfficePermission("facilities.issue.report", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_facility_issue_create", {
    p_actor: current.identity.userId,
    p_site: input.siteId,
    p_room: input.roomId ?? null,
    p_category: input.category,
    p_priority: input.priority,
    p_title: input.title,
    p_description: input.description,
  });
  if (error || typeof data !== "string") throw new OfficeFacilitiesError(400, error?.message ?? "Unable to report facility issue");
  return { incident_id: data };
}

export async function transitionFacilityIssue(input: { incidentId: string; status: string; ownerUserId?: string; note?: string }) {
  const current = await requireOfficePermission("facilities.manage", { type: "COMPANY" });
  const { data, error } = await current.admin.rpc("office_facility_issue_transition", {
    p_actor: current.identity.userId,
    p_incident: input.incidentId,
    p_status: input.status,
    p_owner: input.ownerUserId ?? null,
    p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeFacilitiesError(400, error?.message ?? "Unable to update facility issue");
  return { status: data };
}
