"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CorporateAccessError, requireCorporateCapability } from "@/lib/corporate/authorization";
import { createClient } from "@/lib/supabase/server";

const meetingSchema = z.object({ meetingNumber: z.string().trim().min(1).max(80), financialYear: z.string().regex(/^FY \d{4}\u2013\d{2}$/), meetingType: z.enum(["REGULAR_BOARD", "URGENT_BOARD", "ADJOURNED", "COMMITTEE", "OTHER"]), scheduledAt: z.string().datetime().optional(), location: z.string().trim().max(500).optional(), purpose: z.string().trim().max(4_000).optional() });

export type ActionResult = { ok: boolean; message: string; id?: string };

function actionFailure(error: unknown): ActionResult {
  if (error instanceof CorporateAccessError) return { ok: false, message: error.message };
  return { ok: false, message: "The request could not be completed. No corporate record was changed." };
}

export async function createBoardMeeting(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireCorporateCapability("meeting.create");
    const values = meetingSchema.parse(input);
    const supabase = await createClient();
    if (!supabase) return { ok: false, message: "Corporate identity is not configured." };
    const { data, error } = await supabase.from("board_meetings").insert({
      meeting_number: values.meetingNumber,
      financial_year: values.financialYear,
      meeting_type: values.meetingType,
      scheduled_at: values.scheduledAt ?? null,
      location: values.location ?? null,
      purpose: values.purpose ?? null,
      lifecycle_status: "PROPOSED",
      created_by: actor.id,
    }).select("id").single();
    if (error) return { ok: false, message: "The meeting could not be created. Check the configured record policy." };
    await supabase.rpc("write_audit_event", { p_action: "MEETING_CREATED", p_entity_type: "board_meeting", p_entity_id: data.id, p_context: { aal: actor.aal } });
    revalidatePath("/corporate/board"); revalidatePath("/corporate/meetings"); revalidatePath("/corporate/dashboard");
    return { ok: true, message: "Meeting created as PROPOSED.", id: data.id };
  } catch (error) { return actionFailure(error); }
}

export async function finaliseMinutes(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireCorporateCapability("meeting.finalize");
    const values = z.object({ meetingId: z.string().uuid(), minutesVersionId: z.string().uuid(), checksum: z.string().regex(/^[a-f0-9]{64}$/i) }).parse(input);
    const supabase = await createClient();
    if (!supabase) return { ok: false, message: "Corporate identity is not configured." };
    const { error } = await supabase.rpc("finalise_minutes", { p_meeting_id: values.meetingId, p_minutes_version_id: values.minutesVersionId, p_checksum: values.checksum });
    if (error) return { ok: false, message: "Minutes were not finalised. Verify the current record state and approval route." };
    await supabase.rpc("write_audit_event", { p_action: "MINUTES_FINALISED", p_entity_type: "board_meeting", p_entity_id: values.meetingId, p_context: { minutes_version_id: values.minutesVersionId, aal: actor.aal } });
    revalidatePath("/corporate/board"); revalidatePath("/corporate/meetings");
    return { ok: true, message: "Minutes finalised and locked. Corrections require a linked amendment." };
  } catch (error) { return actionFailure(error); }
}

