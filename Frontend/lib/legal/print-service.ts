import "server-only";

import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createLegalPrintProof,
  createLegalPrintReservation,
  legalPrintProofHash,
  type LegalPrintReservation,
} from "@/lib/legal/print-reservation";

type ReservationRow = {
  job_id: string;
  reference_no: string;
  issued_on: string;
  attempt_count: number;
};

type PrintEvent = "DIALOG_OPENED" | "DIALOG_CLOSED";

export type PrintServiceFailure = "CONFIGURATION" | "RATE_LIMIT" | "UNAVAILABLE" | "NOT_FOUND";

function firstReservationRow(value: unknown): ReservationRow | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const candidate = row as Record<string, unknown>;
  if (
    typeof candidate.job_id !== "string"
    || typeof candidate.reference_no !== "string"
    || typeof candidate.issued_on !== "string"
    || typeof candidate.attempt_count !== "number"
  ) return null;
  return {
    job_id: candidate.job_id,
    reference_no: candidate.reference_no,
    issued_on: candidate.issued_on,
    attempt_count: candidate.attempt_count,
  };
}

type PrintEventRow = {
  status: "RESERVED" | "PRINT_SUBMITTED" | "PRINTED";
  reference_no: string;
};

function firstEventRow(value: unknown): PrintEventRow | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;

  const candidate = row as Record<string, unknown>;
  if (
    (candidate.status !== "RESERVED"
      && candidate.status !== "PRINT_SUBMITTED"
      && candidate.status !== "PRINTED")
    || typeof candidate.reference_no !== "string"
  ) return null;

  return {
    status: candidate.status,
    reference_no: candidate.reference_no,
  };
}

function fingerprint(identity: string, signingKey: string) {
  return createHmac("sha256", signingKey).update(`KRAVIA/legal-print-visitor/v1:${identity}`, "utf8").digest("hex");
}

function isRateLimitError(message: string | undefined) {
  return Boolean(message?.includes("LEGAL_PRINT_RATE_LIMIT"));
}

export async function reserveLegalPrintJob(input: {
  documentPath: string;
  documentTitle: string;
  documentVersion: string;
  documentHash: string;
  visitorIdentity: string;
  signingKey: string;
}): Promise<{ reservation: LegalPrintReservation } | { failure: PrintServiceFailure }> {
  const supabase = createAdminClient();
  if (!supabase) return { failure: "CONFIGURATION" };

  const proof = createLegalPrintProof();
  const { data, error } = await supabase.rpc("reserve_legal_print_job", {
    p_document_path: input.documentPath,
    p_document_title: input.documentTitle,
    p_document_version: Number(input.documentVersion),
    p_content_sha256: input.documentHash,
    p_visitor_fingerprint_hash: fingerprint(input.visitorIdentity, input.signingKey),
    p_reservation_token_hash: legalPrintProofHash(proof),
  });
  if (error) return { failure: isRateLimitError(error.message) ? "RATE_LIMIT" : "UNAVAILABLE" };

  const row = firstReservationRow(data);
  if (!row) return { failure: "UNAVAILABLE" };
  return {
    reservation: createLegalPrintReservation({
      id: row.job_id,
      documentPath: input.documentPath,
      documentVersion: input.documentVersion,
      documentHash: input.documentHash,
      reference: row.reference_no,
      issuedOn: row.issued_on,
      attempts: row.attempt_count,
    }, proof),
  };
}

export async function recordLegalPrintEvent(
  reservation: LegalPrintReservation,
  event: PrintEvent,
): Promise<{ ok: true } | { failure: PrintServiceFailure }> {
  const supabase = createAdminClient();
  if (!supabase) return { failure: "CONFIGURATION" };

  const { data, error } = await supabase.rpc("record_legal_print_event", {
    p_job_id: reservation.id,
    p_reservation_token_hash: legalPrintProofHash(reservation.proof),
    p_event: event,
  });
  if (error) return { failure: "UNAVAILABLE" };
  if (!firstEventRow(data)) return { failure: "NOT_FOUND" };
  return { ok: true };
}
