import "server-only";

import { requireOfficeActor } from "@/lib/office/permission-engine";

export class OfficeRoleSeatError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeRoleSeatError";
  }
}

export type OfficeRoleSeatAction =
  | { action: "CREATE"; code: string; label: string; position: string; department: string; description: string; requires_department_handover: boolean }
  | { action: "GRANT"; seat_id: string; permission: string; scope_type: string; scope_key?: string | null; exclusive: boolean }
  | { action: "REVIEW_GRANT"; grant_id: string; approve: boolean; reason: string }
  | { action: "PROPOSE"; seat_id: string; recipient_id: string; reason: string }
  | { action: "ACCEPT"; transfer_id: string }
  | { action: "VERIFY_ITEM"; item_id: string; evidence: string }
  | { action: "FINALIZE"; transfer_id: string; evidence: string }
  | { action: "CANCEL"; transfer_id: string; reason: string };

function assertResult(result: { error?: { message?: string } | null }, message: string) {
  if (result.error) throw new OfficeRoleSeatError(503, message);
}

export async function getOfficeRoleSeatPortfolio() {
  const { admin, identity } = await requireOfficeActor();
  const actorId = identity.userId;
  const isOwner = identity.roles.includes("OWNER");
  const isReviewer = identity.roles.some(role => ["OWNER", "ADMIN", "DIRECTOR"].includes(role));

  const [seats, transfers, items, grants, positions, departments, people, jobs, roleGrants, accessProfiles, permissionCatalog, currentJob, functionalPositions] = await Promise.all([
    admin.from("office_role_seats")
      .select("id,seat_code,label,position_code,department_code,description,responsibilities,current_holder_user_id,status,department_ownership_required,version,created_at")
      .order("label").limit(300),
    admin.from("office_role_seat_transfers")
      .select("id,seat_id,from_user_id,to_user_id,proposed_by,reason,status,proposed_at,accepted_at,completed_at,completed_by,cutover_evidence")
      .order("proposed_at", { ascending: false }).limit(300),
    admin.from("office_role_seat_transfer_items")
      .select("id,transfer_id,item_code,label,category,required,status,evidence_reference,verified_by,verified_at")
      .limit(800),
    admin.from("office_role_seat_grants")
      .select("id,seat_id,permission_code,scope_type,scope_key,exclusive,status,created_by,reviewed_by")
      .limit(1200),
    admin.from("office_position_catalog").select("code,label,family,level,is_manager")
      .eq("active", true).order("label"),
    admin.from("office_department_catalog").select("code,label").eq("active", true).order("label"),
    admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status")
      .eq("status", "ACTIVE").order("display_name"),
    admin.from("office_job_assignments").select("user_id,position_code,department_code,status,start_date"),
    admin.from("office_user_roles").select("user_id,role,expires_at"),
    admin.from("office_user_access_profiles")
      .select("user_id,profile_code,scope_type,scope_key,status,effective_from,expires_at"),
    admin.from("office_permission_catalog")
      .select("code,module,action,high_risk,active,owner_bypass").eq("active",true).order("code"),
    admin.from("office_job_assignments")
      .select("position_code,department_code,status,team_key,product_key")
      .eq("user_id", actorId).maybeSingle(),
    admin.from("office_employee_functional_positions")
      .select("position_code,department_code,responsibilities")
      .eq("employee_user_id", actorId).eq("active", true),
  ]);
  for (const response of [seats, transfers, items, grants, positions, departments, people, jobs, roleGrants, accessProfiles, permissionCatalog, currentJob, functionalPositions]) {
    assertResult(response, "Role portfolio records are not available. Verify the reviewed database migration.");
  }

  const allSeats = seats.data ?? [];
  const allTransfers = transfers.data ?? [];
  const visibleTransfers = allTransfers.filter(t =>
    isReviewer || t.from_user_id === actorId || t.to_user_id === actorId || t.proposed_by === actorId);
  const visibleSeatIds = new Set(allSeats.filter(s =>
    isReviewer || s.current_holder_user_id === actorId ||
    visibleTransfers.some(t => t.seat_id === s.id)).map(s => s.id));
  const visibleTransferIds = new Set(visibleTransfers.filter(t => visibleSeatIds.has(t.seat_id)).map(t => t.id));

  return {
    actor: {
      user_id: actorId, display_name: identity.displayName ?? "",
      roles: identity.roles, is_owner: isOwner, is_reviewer: isReviewer,
    },
    current_job: currentJob.data ?? null,
    functional_positions: functionalPositions.data ?? [],
    seats: allSeats.filter(s => visibleSeatIds.has(s.id)),
    transfers: visibleTransfers.filter(t => visibleTransferIds.has(t.id)),
    items: (items.data ?? []).filter(i => visibleTransferIds.has(i.transfer_id)),
    grants: (grants.data ?? []).filter(g => visibleSeatIds.has(g.seat_id)),
    positions: isOwner ? positions.data ?? [] : [],
    departments: isOwner ? departments.data ?? [] : [],
    permissions: isOwner ? permissionCatalog.data ?? [] : [],
    people: isReviewer || visibleSeatIds.size > 0 ? people.data ?? [] :
      (people.data ?? []).filter(person => person.user_id === actorId),
    employee_directory: isOwner ? (people.data ?? []).map(person => ({
      ...person,
      primary_job: (jobs.data ?? []).find(job => job.user_id === person.user_id) ?? null,
      security_roles: (roleGrants.data ?? [])
        .filter(grant => grant.user_id === person.user_id &&
          (!grant.expires_at || Date.parse(grant.expires_at) > Date.now()))
        .map(grant => grant.role),
      profiles: (accessProfiles.data ?? [])
        .filter(grant => grant.user_id === person.user_id)
        .map(grant => ({
          profile_code: grant.profile_code, status: grant.status,
          effective_from: grant.effective_from, expires_at: grant.expires_at,
        })),
    })) : [],
    notice: "A job title or security role is not a role-seat assignment. Seat grants require explicit review; department ownership and provider access transfer separately.",
  };
}

export async function changeOfficeRoleSeat(input: OfficeRoleSeatAction) {
  const { admin, identity } = await requireOfficeActor();
  const actor = identity.userId;
  let method: string;
  let params: Record<string, unknown>;

  switch (input.action) {
    case "CREATE":
      method = "office_role_seat_create";
      params = { p_actor: actor, p_code: input.code, p_label: input.label,
        p_position: input.position, p_department: input.department,
        p_description: input.description, p_department_owner: input.requires_department_handover };
      break;
    case "GRANT":
      method = "office_role_seat_add_grant";
      params = { p_actor: actor, p_seat: input.seat_id, p_permission: input.permission,
        p_scope_type: input.scope_type, p_scope_key: input.scope_key ?? null,
        p_exclusive: input.exclusive };
      break;
    case "REVIEW_GRANT":
      method = "office_role_seat_review_grant";
      params = { p_actor: actor, p_grant: input.grant_id, p_approve: input.approve, p_reason: input.reason };
      break;
    case "PROPOSE":
      method = "office_role_seat_propose_transfer";
      params = { p_actor: actor, p_seat: input.seat_id, p_recipient: input.recipient_id, p_reason: input.reason };
      break;
    case "ACCEPT":
      method = "office_role_seat_accept_transfer";
      params = { p_actor: actor, p_transfer: input.transfer_id };
      break;
    case "VERIFY_ITEM":
      method = "office_role_seat_verify_item";
      params = { p_actor: actor, p_item: input.item_id, p_evidence: input.evidence };
      break;
    case "FINALIZE":
      method = "office_role_seat_finalize_transfer";
      params = { p_actor: actor, p_transfer: input.transfer_id, p_evidence: input.evidence };
      break;
    case "CANCEL":
      method = "office_role_seat_cancel_transfer";
      params = { p_actor: actor, p_transfer: input.transfer_id, p_reason: input.reason };
      break;
  }
  const { data, error } = await admin.rpc(method, params);
  if (error) throw new OfficeRoleSeatError(409, error.message || "Role-seat action rejected");
  return { result: data };
}
