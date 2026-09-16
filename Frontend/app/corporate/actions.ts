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
    await supabase.rpc("emit_corporate_event", { p_event_type: "meeting.created", p_entity_type: "board_meeting", p_entity_id: data.id, p_idempotency_key: `meeting.created:${data.id}`, p_payload: { financialYear: values.financialYear, meetingType: values.meetingType } });
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
    await supabase.rpc("emit_corporate_event", { p_event_type: "minutes.finalised", p_entity_type: "board_meeting", p_entity_id: values.meetingId, p_idempotency_key: `minutes.finalised:${values.meetingId}:${values.minutesVersionId}`, p_payload: { minutesVersionId: values.minutesVersionId } });
    revalidatePath("/corporate/board"); revalidatePath("/corporate/meetings");
    return { ok: true, message: "Minutes finalised and locked. Corrections require a linked amendment." };
  } catch (error) { return actionFailure(error); }
}



const financeImportSchema = z.object({ bankAccountId: z.string().uuid(), sourceDocumentId: z.string().uuid().optional(), csv: z.string().min(1).max(2_000_000) });

export async function stageBankCsvImport(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireCorporateCapability("finance.import");
    const values = financeImportSchema.parse(input);
    const { parseBankCsv, findPotentialDuplicates } = await import("@/lib/corporate/finance");
    const parsed = parseBankCsv(values.csv);
    if (parsed.problems.length) return { ok: false, message: `Import has ${parsed.problems.length} validation problem(s); nothing was inserted.` };
    const supabase = await createClient();
    if (!supabase) return { ok: false, message: "Corporate identity is not configured." };
    const { data: existing } = await supabase.from("financial_transactions").select("description_fingerprint").eq("bank_account_id", values.bankAccountId).limit(1000);
    const duplicates = findPotentialDuplicates(parsed.rows, new Set((existing ?? []).map((row: { description_fingerprint: string }) => row.description_fingerprint)));
    const reference = `IMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: importRecord, error } = await supabase.from("financial_imports").insert({ reference, bank_account_id: values.bankAccountId, source_type: "CSV", source_document_id: values.sourceDocumentId ?? null, uploaded_by: actor.id, row_count: parsed.rows.length, duplicate_count: duplicates.length, validation_status: duplicates.length ? "REVIEW_REQUIRED" : "VALIDATED" }).select("id").single();
    if (error) return { ok: false, message: "The import could not be staged." };
    const rows = parsed.rows.map((row) => ({ import_id: importRecord.id, row_number: row.row, original_data: { date: row.date, reference: row.reference, description: row.description, debit: row.debit, credit: row.credit, balance: row.balance }, parsed_data: row, possible_duplicate: duplicates.includes(row.row), validation_status: duplicates.includes(row.row) ? "REVIEW_REQUIRED" : "VALIDATED" }));
    const { error: rowsError } = await supabase.from("financial_import_rows").insert(rows);
    if (rowsError) return { ok: false, message: "The import was staged but its rows need controlled recovery. Do not retry blindly." };
    await supabase.rpc("write_audit_event", { p_action: "FINANCIAL_IMPORT_STAGED", p_entity_type: "financial_import", p_entity_id: importRecord.id, p_context: { row_count: parsed.rows.length, duplicate_count: duplicates.length } });
    await supabase.rpc("emit_corporate_event", { p_event_type: "finance.import_staged", p_entity_type: "financial_import", p_entity_id: importRecord.id, p_idempotency_key: `finance.import_staged:${importRecord.id}`, p_payload: { duplicateCount: duplicates.length } });
    revalidatePath("/corporate/finance"); revalidatePath("/corporate/data");
    return { ok: true, message: `Import staged as ${reference}; review is required before transactions are inserted.`, id: importRecord.id };
  } catch (error) { return actionFailure(error); }
}

export async function confirmFinancialImport(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireCorporateCapability("finance.manage");
    const values = z.object({ importId: z.string().uuid() }).parse(input);
    const supabase = await createClient();
    if (!supabase) return { ok: false, message: "Corporate identity is not configured." };
    const { error } = await supabase.rpc("confirm_financial_import", { p_import_id: values.importId });
    if (error) return { ok: false, message: "Import confirmation failed. Check the staged rows and duplicate review state." };
    await supabase.rpc("write_audit_event", { p_action: "FINANCIAL_IMPORT_CONFIRMED", p_entity_type: "financial_import", p_entity_id: values.importId, p_context: { aal: actor.aal } });
    await supabase.rpc("emit_corporate_event", { p_event_type: "finance.import_confirmed", p_entity_type: "financial_import", p_entity_id: values.importId, p_idempotency_key: `finance.import_confirmed:${values.importId}`, p_payload: {} });
    revalidatePath("/corporate/finance"); revalidatePath("/corporate/data");
    return { ok: true, message: "Validated staged rows were confirmed as financial transactions." };
  } catch (error) { return actionFailure(error); }
}
