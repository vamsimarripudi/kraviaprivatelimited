import "server-only";

import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";

export class OfficeBoardError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeBoardError";
  }
}

async function actor() {
  try { return await requireOfficeActor(); }
  catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeBoardError(error.status, error.message);
    throw error;
  }
}

async function hasPermission(code: string) {
  const current = await actor();
  const decision = await resolveOfficePermission(current.admin, current.identity, code, { type: "COMPANY" });
  return { ...current, allowed: decision.allowed, decision };
}

async function requirePermission(code: string) {
  const current = await hasPermission(code);
  if (!current.allowed) throw new OfficeBoardError(403, current.decision.reason);
  return current;
}

async function requireRead() {
  const current = await actor();
  if (current.identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR")) return current;
  const decision = await resolveOfficePermission(current.admin, current.identity, "secretarial.board.read", { type: "COMPANY" });
  if (!decision.allowed) throw new OfficeBoardError(403, decision.reason);
  return current;
}

async function rpc(permission: string | null, name: string, args: Record<string, unknown>) {
  const current = permission ? await requirePermission(permission) : await requireRead();
  const { data, error } = await current.admin.rpc(name, args);
  if (error) throw new OfficeBoardError(400, error.message);
  return data;
}

export async function getOfficeBoardOverview() {
  const current = await requireRead();
  const [meetings, participants, agenda, minutes, resolutions, actions, followups, events, people] = await Promise.all([
    current.admin.from("office_board_meetings").select("id,meeting_code,meeting_kind,title,scheduled_start,scheduled_end,timezone,venue_mode,venue_details,meeting_reference,status,chair_user_id,chair_name,secretary_user_id,notice_reference,notice_issued_at,agenda_locked_at,quorum_confirmed,quorum_note,started_at,completed_at,minutes_locked_at,created_at,updated_at").order("scheduled_start", { ascending: false }).limit(200),
    current.admin.from("office_board_participants").select("id,meeting_id,participant_user_id,participant_name,capacity,invitation_status,attendance_status,attendance_note,conflict_note,acknowledged_at,attendance_recorded_at,created_at").order("created_at"),
    current.admin.from("office_board_agenda_items").select("id,meeting_id,item_no,title,purpose,background_note,proposed_resolution_text,owner_user_id,presenter_name,status,decision_note,locked_at,decided_at,created_at,updated_at").order("item_no"),
    current.admin.from("office_board_minutes_versions").select("id,meeting_id,version_no,body,status,prepared_by,review_submitted_at,approved_by,approved_at,approval_note,locked_by,locked_at,content_hash,created_at,updated_at").order("version_no", { ascending: false }),
    current.admin.from("office_board_resolutions").select("id,resolution_code,meeting_id,agenda_item_id,resolution_type,title,resolution_text,approval_basis,approved_by_name,recorded_by,recorded_at,content_hash,source_reference,status").order("recorded_at", { ascending: false }),
    current.admin.from("office_board_actions").select("id,action_code,meeting_id,agenda_item_id,resolution_id,title,description,owner_user_id,due_at,status,blocker_note,completion_note,completed_at,created_at,updated_at").order("created_at", { ascending: false }),
    current.admin.from("office_secretarial_followups").select("id,followup_code,meeting_id,resolution_id,title,authority,form_code,due_at,due_basis,source_reference,owner_user_id,reviewer_user_id,status,filing_reference,evidence_reference,filed_at,acknowledged_at,closed_at,created_at,updated_at").order("created_at", { ascending: false }),
    current.admin.from("office_board_events").select("id,meeting_id,actor_user_id,event_type,entity_type,entity_id,previous_status,new_status,note,metadata,created_at").order("created_at", { ascending: false }).limit(1000),
    current.admin.from("office_identity_users").select("user_id,status,display_name,job_title,primary_department").eq("status", "ACTIVE").order("display_name"),
  ]);
  if ([meetings, participants, agenda, minutes, resolutions, actions, followups, events, people].some((result) => result.error)) {
    throw new OfficeBoardError(503, "Board and secretarial records are temporarily unavailable");
  }

  const permissions = await Promise.all([
    "secretarial.board.manage",
    "secretarial.agenda.manage",
    "secretarial.minutes.prepare",
    "secretarial.minutes.lock",
    "secretarial.resolution.record",
    "secretarial.filing.manage",
  ].map(async (code) => [code, (await resolveOfficePermission(current.admin, current.identity, code, { type: "COMPANY" })).allowed] as const));
  const capability = Object.fromEntries(permissions);
  const director = current.identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR");

  return {
    generated_at: new Date().toISOString(),
    actor: { user_id: current.identity.userId, roles: current.identity.roles, department: current.identity.department ?? null },
    capabilities: {
      manage_board: Boolean(capability["secretarial.board.manage"]),
      manage_agenda: Boolean(capability["secretarial.agenda.manage"]),
      prepare_minutes: Boolean(capability["secretarial.minutes.prepare"]),
      lock_minutes: Boolean(capability["secretarial.minutes.lock"]),
      record_resolution: Boolean(capability["secretarial.resolution.record"]),
      manage_followup: Boolean(capability["secretarial.filing.manage"]),
      director,
    },
    people: people.data ?? [],
    meetings: meetings.data ?? [],
    participants: participants.data ?? [],
    agenda: agenda.data ?? [],
    minutes: minutes.data ?? [],
    resolutions: resolutions.data ?? [],
    actions: actions.data ?? [],
    followups: followups.data ?? [],
    events: events.data ?? [],
    disclaimer: "KRAVIA Office records the board process and evidence. It does not calculate statutory notice, quorum or filing deadlines; those determinations must be entered with their professional/source basis.",
  };
}

export async function createBoardMeeting(input: {
  kind: "BOARD" | "COMMITTEE" | "AGM" | "EGM" | "OTHER";
  title: string;
  start: string;
  end?: string;
  timezone?: string;
  venueMode: "PHYSICAL" | "VIDEO" | "HYBRID";
  venueDetails?: string;
  chairUserId?: string;
  chairName?: string;
  secretaryUserId?: string;
}) {
  const current = await requirePermission("secretarial.board.manage");
  const data = await rpc("secretarial.board.manage", "office_board_create_meeting", {
    p_actor: current.identity.userId,
    p_kind: input.kind,
    p_title: input.title,
    p_start: input.start,
    p_end: input.end ?? null,
    p_timezone: input.timezone ?? "Asia/Kolkata",
    p_venue_mode: input.venueMode,
    p_venue_details: input.venueDetails?.trim() || null,
    p_chair_user: input.chairUserId ?? null,
    p_chair_name: input.chairName?.trim() || null,
    p_secretary_user: input.secretaryUserId ?? null,
  });
  if (typeof data !== "string") throw new OfficeBoardError(400, "Unable to create board meeting");
  return { meeting_id: data };
}

export async function addBoardParticipant(input: { meetingId: string; userId?: string; name: string; capacity: "CHAIR" | "DIRECTOR" | "CS" | "SHAREHOLDER" | "INVITEE" | "AUDITOR" | "LEGAL" | "OTHER" }) {
  const current = await requirePermission("secretarial.board.manage");
  const data = await current.admin.rpc("office_board_add_participant", { p_actor: current.identity.userId, p_meeting: input.meetingId, p_user: input.userId ?? null, p_name: input.name, p_capacity: input.capacity });
  if (data.error || typeof data.data !== "string") throw new OfficeBoardError(400, data.error?.message ?? "Unable to add participant");
  return { participant_id: data.data };
}

export async function addBoardAgendaItem(input: { meetingId: string; title: string; purpose: "INFORMATION" | "DISCUSSION" | "DECISION" | "RESOLUTION"; background?: string; proposedResolution?: string; ownerUserId?: string; presenter?: string }) {
  const current = await requirePermission("secretarial.agenda.manage");
  const { data, error } = await current.admin.rpc("office_board_add_agenda_item", { p_actor: current.identity.userId, p_meeting: input.meetingId, p_title: input.title, p_purpose: input.purpose, p_background: input.background?.trim() || null, p_proposed_resolution: input.proposedResolution?.trim() || null, p_owner: input.ownerUserId ?? null, p_presenter: input.presenter?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to add agenda item");
  return { agenda_item_id: data };
}

export async function issueBoardNotice(meetingId: string, noticeReference: string) {
  const current = await requirePermission("secretarial.board.manage");
  const { data, error } = await current.admin.rpc("office_board_issue_notice", { p_actor: current.identity.userId, p_meeting: meetingId, p_notice_reference: noticeReference });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to issue notice");
  return { status: data };
}

export async function lockBoardAgenda(meetingId: string) {
  const current = await requirePermission("secretarial.agenda.manage");
  const { data, error } = await current.admin.rpc("office_board_lock_agenda", { p_actor: current.identity.userId, p_meeting: meetingId });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to lock agenda");
  return { status: data };
}

export async function recordBoardAttendance(input: { participantId: string; status: "PRESENT" | "ABSENT" | "LEAVE_OF_ABSENCE"; note?: string; conflict?: string }) {
  const current = await requirePermission("secretarial.board.manage");
  const { data, error } = await current.admin.rpc("office_board_record_attendance", { p_actor: current.identity.userId, p_participant: input.participantId, p_status: input.status, p_note: input.note?.trim() || null, p_conflict: input.conflict?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to record attendance");
  return { status: data };
}

export async function startBoardMeeting(input: { meetingId: string; quorumNote: string }) {
  const current = await requireRead();
  const { data, error } = await current.admin.rpc("office_board_start_meeting", { p_actor: current.identity.userId, p_meeting: input.meetingId, p_quorum_confirmed: true, p_quorum_note: input.quorumNote });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to start meeting");
  return { status: data };
}

export async function decideBoardAgendaItem(input: { itemId: string; outcome: "NOTED" | "DECIDED" | "DEFERRED" | "WITHDRAWN"; note: string }) {
  const current = await requireRead();
  const { data, error } = await current.admin.rpc("office_board_decide_agenda_item", { p_actor: current.identity.userId, p_item: input.itemId, p_outcome: input.outcome, p_note: input.note });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to record agenda decision");
  return { status: data };
}

export async function completeBoardMeeting(meetingId: string) {
  const current = await requireRead();
  const { data, error } = await current.admin.rpc("office_board_complete_meeting", { p_actor: current.identity.userId, p_meeting: meetingId });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to complete meeting");
  return { status: data };
}

export async function saveBoardMinutes(meetingId: string, body: string) {
  const current = await requirePermission("secretarial.minutes.prepare");
  const { data, error } = await current.admin.rpc("office_board_save_minutes_draft", { p_actor: current.identity.userId, p_meeting: meetingId, p_body: body });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to save minutes draft");
  return { minutes_id: data };
}

export async function submitBoardMinutes(minutesId: string) {
  const current = await requirePermission("secretarial.minutes.prepare");
  const { data, error } = await current.admin.rpc("office_board_submit_minutes_review", { p_actor: current.identity.userId, p_minutes: minutesId });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to submit minutes for review");
  return { status: data };
}

export async function approveBoardMinutes(minutesId: string, note?: string) {
  const current = await requireRead();
  if (!current.identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR")) throw new OfficeBoardError(403, "Director approval is required");
  const { data, error } = await current.admin.rpc("office_board_approve_minutes", { p_actor: current.identity.userId, p_minutes: minutesId, p_note: note?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to approve minutes");
  return { status: data };
}

export async function lockBoardMinutes(minutesId: string) {
  const current = await requirePermission("secretarial.minutes.lock");
  const { data, error } = await current.admin.rpc("office_board_lock_minutes", { p_actor: current.identity.userId, p_minutes: minutesId });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to lock minutes");
  return { content_hash: data };
}

export async function recordBoardResolution(input: { itemId: string; type: "BOARD" | "ORDINARY" | "SPECIAL" | "CIRCULAR" | "OTHER"; title: string; text: string; approvalBasis: string; approvedByName?: string; sourceReference?: string }) {
  const current = await requirePermission("secretarial.resolution.record");
  const { data, error } = await current.admin.rpc("office_board_record_resolution", { p_actor: current.identity.userId, p_item: input.itemId, p_type: input.type, p_title: input.title, p_text: input.text, p_approval_basis: input.approvalBasis, p_approved_by_name: input.approvedByName?.trim() || null, p_source_reference: input.sourceReference?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to record resolution");
  return { resolution_id: data };
}

export async function createBoardAction(input: { meetingId: string; agendaItemId?: string; resolutionId?: string; title: string; description?: string; ownerUserId: string; dueAt?: string }) {
  const current = await requirePermission("secretarial.board.manage");
  const { data, error } = await current.admin.rpc("office_board_create_action", { p_actor: current.identity.userId, p_meeting: input.meetingId, p_agenda: input.agendaItemId ?? null, p_resolution: input.resolutionId ?? null, p_title: input.title, p_description: input.description?.trim() || null, p_owner: input.ownerUserId, p_due_at: input.dueAt ?? null });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to create board action");
  return { action_id: data };
}

export async function transitionBoardAction(input: { actionId: string; status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED"; note?: string }) {
  const current = await requireRead();
  const { data, error } = await current.admin.rpc("office_board_transition_action", { p_actor: current.identity.userId, p_action: input.actionId, p_status: input.status, p_note: input.note?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to update board action");
  return { status: data };
}

export async function createSecretarialFollowup(input: { meetingId?: string; resolutionId?: string; title: string; authority: string; formCode?: string; dueAt?: string; dueBasis: string; sourceReference: string; ownerUserId: string; reviewerUserId?: string }) {
  const current = await requirePermission("secretarial.filing.manage");
  const { data, error } = await current.admin.rpc("office_secretarial_create_followup", { p_actor: current.identity.userId, p_meeting: input.meetingId ?? null, p_resolution: input.resolutionId ?? null, p_title: input.title, p_authority: input.authority, p_form_code: input.formCode?.trim() || null, p_due_at: input.dueAt ?? null, p_due_basis: input.dueBasis, p_source_reference: input.sourceReference, p_owner: input.ownerUserId, p_reviewer: input.reviewerUserId ?? null });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to create secretarial follow-up");
  return { followup_id: data };
}

export async function transitionSecretarialFollowup(input: { followupId: string; status: "OPEN" | "PREPARED" | "APPROVED" | "FILED" | "ACKNOWLEDGED" | "NOT_REQUIRED" | "CLOSED"; filingReference?: string; evidenceReference?: string }) {
  const current = await requirePermission("secretarial.filing.manage");
  const { data, error } = await current.admin.rpc("office_secretarial_transition_followup", { p_actor: current.identity.userId, p_followup: input.followupId, p_status: input.status, p_reference: input.filingReference?.trim() || null, p_evidence: input.evidenceReference?.trim() || null });
  if (error || typeof data !== "string") throw new OfficeBoardError(400, error?.message ?? "Unable to update secretarial follow-up");
  return { status: data };
}
