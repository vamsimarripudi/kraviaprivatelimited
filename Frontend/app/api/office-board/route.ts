import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  addBoardAgendaItem,
  addBoardParticipant,
  approveBoardMinutes,
  completeBoardMeeting,
  createBoardAction,
  createBoardMeeting,
  createSecretarialFollowup,
  decideBoardAgendaItem,
  getOfficeBoardOverview,
  issueBoardNotice,
  lockBoardAgenda,
  lockBoardMinutes,
  OfficeBoardError,
  recordBoardAttendance,
  recordBoardResolution,
  saveBoardMinutes,
  startBoardMeeting,
  submitBoardMinutes,
  transitionBoardAction,
  transitionSecretarialFollowup,
} from "@/lib/office/board-server";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optional = (max: number) => z.string().trim().max(max).optional();
const uuidOptional = z.string().uuid().optional();
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_MEETING"), kind: z.enum(["BOARD","COMMITTEE","AGM","EGM","OTHER"]), title: text(3,220), start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }).optional(), timezone: optional(80), venue_mode: z.enum(["PHYSICAL","VIDEO","HYBRID"]), venue_details: optional(1000), chair_user_id: uuidOptional, chair_name: optional(180), secretary_user_id: uuidOptional }),
  z.object({ action: z.literal("ADD_PARTICIPANT"), meeting_id: z.string().uuid(), user_id: uuidOptional, name: text(2,180), capacity: z.enum(["CHAIR","DIRECTOR","CS","SHAREHOLDER","INVITEE","AUDITOR","LEGAL","OTHER"]) }),
  z.object({ action: z.literal("ADD_AGENDA"), meeting_id: z.string().uuid(), title: text(3,220), purpose: z.enum(["INFORMATION","DISCUSSION","DECISION","RESOLUTION"]), background: optional(8000), proposed_resolution: optional(8000), owner_user_id: uuidOptional, presenter: optional(180) }),
  z.object({ action: z.literal("ISSUE_NOTICE"), meeting_id: z.string().uuid(), notice_reference: text(3,500) }),
  z.object({ action: z.literal("LOCK_AGENDA"), meeting_id: z.string().uuid() }),
  z.object({ action: z.literal("RECORD_ATTENDANCE"), participant_id: z.string().uuid(), status: z.enum(["PRESENT","ABSENT","LEAVE_OF_ABSENCE"]), note: optional(1000), conflict: optional(2000) }),
  z.object({ action: z.literal("START_MEETING"), meeting_id: z.string().uuid(), quorum_note: text(3,2000) }),
  z.object({ action: z.literal("DECIDE_AGENDA"), item_id: z.string().uuid(), outcome: z.enum(["NOTED","DECIDED","DEFERRED","WITHDRAWN"]), note: text(3,4000) }),
  z.object({ action: z.literal("COMPLETE_MEETING"), meeting_id: z.string().uuid() }),
  z.object({ action: z.literal("SAVE_MINUTES"), meeting_id: z.string().uuid(), body: text(20,50000) }),
  z.object({ action: z.literal("SUBMIT_MINUTES"), minutes_id: z.string().uuid() }),
  z.object({ action: z.literal("APPROVE_MINUTES"), minutes_id: z.string().uuid(), note: optional(2000) }),
  z.object({ action: z.literal("LOCK_MINUTES"), minutes_id: z.string().uuid() }),
  z.object({ action: z.literal("RECORD_RESOLUTION"), item_id: z.string().uuid(), type: z.enum(["BOARD","ORDINARY","SPECIAL","CIRCULAR","OTHER"]), title: text(3,220), resolution_text: text(10,20000), approval_basis: text(3,2000), approved_by_name: optional(180), source_reference: optional(500) }),
  z.object({ action: z.literal("CREATE_ACTION"), meeting_id: z.string().uuid(), agenda_item_id: uuidOptional, resolution_id: uuidOptional, title: text(3,220), description: optional(4000), owner_user_id: z.string().uuid(), due_at: z.string().datetime({ offset: true }).optional() }),
  z.object({ action: z.literal("UPDATE_ACTION"), action_id: z.string().uuid(), status: z.enum(["OPEN","IN_PROGRESS","BLOCKED","DONE","CANCELLED"]), note: optional(2000) }),
  z.object({ action: z.literal("CREATE_FOLLOWUP"), meeting_id: uuidOptional, resolution_id: uuidOptional, title: text(3,220), authority: text(2,180), form_code: optional(80), due_at: z.string().datetime({ offset: true }).optional(), due_basis: text(3,2000), source_reference: text(3,500), owner_user_id: z.string().uuid(), reviewer_user_id: uuidOptional }),
  z.object({ action: z.literal("UPDATE_FOLLOWUP"), followup_id: z.string().uuid(), status: z.enum(["OPEN","PREPARED","APPROVED","FILED","ACKNOWLEDGED","NOT_REQUIRED","CLOSED"]), filing_reference: optional(500), evidence_reference: optional(500) }),
]);

export async function GET() {
  try { return NextResponse.json(await getOfficeBoardOverview(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    const status = error instanceof OfficeBoardError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load board workspace";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin board mutation is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid board request" }, { status: 400 });
  const input = parsed.data;
  try {
    let result: Record<string, unknown>;
    switch (input.action) {
      case "CREATE_MEETING": result = await createBoardMeeting({ kind: input.kind, title: input.title, start: input.start, end: input.end, timezone: input.timezone, venueMode: input.venue_mode, venueDetails: input.venue_details, chairUserId: input.chair_user_id, chairName: input.chair_name, secretaryUserId: input.secretary_user_id }); break;
      case "ADD_PARTICIPANT": result = await addBoardParticipant({ meetingId: input.meeting_id, userId: input.user_id, name: input.name, capacity: input.capacity }); break;
      case "ADD_AGENDA": result = await addBoardAgendaItem({ meetingId: input.meeting_id, title: input.title, purpose: input.purpose, background: input.background, proposedResolution: input.proposed_resolution, ownerUserId: input.owner_user_id, presenter: input.presenter }); break;
      case "ISSUE_NOTICE": result = await issueBoardNotice(input.meeting_id, input.notice_reference); break;
      case "LOCK_AGENDA": result = await lockBoardAgenda(input.meeting_id); break;
      case "RECORD_ATTENDANCE": result = await recordBoardAttendance({ participantId: input.participant_id, status: input.status, note: input.note, conflict: input.conflict }); break;
      case "START_MEETING": result = await startBoardMeeting({ meetingId: input.meeting_id, quorumNote: input.quorum_note }); break;
      case "DECIDE_AGENDA": result = await decideBoardAgendaItem({ itemId: input.item_id, outcome: input.outcome, note: input.note }); break;
      case "COMPLETE_MEETING": result = await completeBoardMeeting(input.meeting_id); break;
      case "SAVE_MINUTES": result = await saveBoardMinutes(input.meeting_id, input.body); break;
      case "SUBMIT_MINUTES": result = await submitBoardMinutes(input.minutes_id); break;
      case "APPROVE_MINUTES": result = await approveBoardMinutes(input.minutes_id, input.note); break;
      case "LOCK_MINUTES": result = await lockBoardMinutes(input.minutes_id); break;
      case "RECORD_RESOLUTION": result = await recordBoardResolution({ itemId: input.item_id, type: input.type, title: input.title, text: input.resolution_text, approvalBasis: input.approval_basis, approvedByName: input.approved_by_name, sourceReference: input.source_reference }); break;
      case "CREATE_ACTION": result = await createBoardAction({ meetingId: input.meeting_id, agendaItemId: input.agenda_item_id, resolutionId: input.resolution_id, title: input.title, description: input.description, ownerUserId: input.owner_user_id, dueAt: input.due_at }); break;
      case "UPDATE_ACTION": result = await transitionBoardAction({ actionId: input.action_id, status: input.status, note: input.note }); break;
      case "CREATE_FOLLOWUP": result = await createSecretarialFollowup({ meetingId: input.meeting_id, resolutionId: input.resolution_id, title: input.title, authority: input.authority, formCode: input.form_code, dueAt: input.due_at, dueBasis: input.due_basis, sourceReference: input.source_reference, ownerUserId: input.owner_user_id, reviewerUserId: input.reviewer_user_id }); break;
      case "UPDATE_FOLLOWUP": result = await transitionSecretarialFollowup({ followupId: input.followup_id, status: input.status, filingReference: input.filing_reference, evidenceReference: input.evidence_reference }); break;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeBoardError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to update board workspace";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
