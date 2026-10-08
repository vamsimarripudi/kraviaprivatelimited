import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const RESERVATION_VERSION = 2;
const RESERVATION_TTL_SECONDS = 15 * 60;
const SUBMITTED_TTL_SECONDS = 30 * 24 * 60 * 60;

export type LegalPrintReservation = {
  version: number;
  id: string;
  documentPath: string;
  documentVersion: string;
  documentHash: string;
  reference: string;
  issuedOn: string;
  expiresAt: number;
  state: "RESERVED" | "SUBMITTED";
  attempts: number;
  proof: string;
};

export type LegalPrintReservationInput = Pick<
  LegalPrintReservation,
  "id" | "documentPath" | "documentVersion" | "documentHash" | "reference" | "issuedOn" | "attempts"
>;

export const legalPrintReservationCookieName = "kravia_legal_print_reservation";

/**
 * The dedicated key is preferred. During a controlled migration the server can
 * derive a context-bound key from an existing server-only root; no browser key
 * and no third-party client is used by this printing workflow.
 */
export function getLegalPrintSigningKey(): string | null {
  const root = process.env.KRAVIA_LEGAL_PRINT_SIGNING_KEY?.trim()
    || process.env.KRAVIA_PUBLIC_CONSENT_HMAC_KEY?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim();
  if (!root || root.length < 32) return null;
  return createHmac("sha256", root).update("KRAVIA/legal-print-reservation/v1").digest("base64url");
}

export function createLegalPrintProof() {
  return randomBytes(32).toString("base64url");
}

export function legalPrintProofHash(proof: string) {
  return createHash("sha256").update(proof, "utf8").digest("hex");
}

function serialise(reservation: LegalPrintReservation): string {
  return Buffer.from(JSON.stringify(reservation), "utf8").toString("base64url");
}

function signature(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

function isReservation(value: unknown): value is LegalPrintReservation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === RESERVATION_VERSION
    && typeof candidate.id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate.id)
    && typeof candidate.documentPath === "string"
    && candidate.documentPath.startsWith("/legal/")
    && typeof candidate.documentVersion === "string"
    && typeof candidate.documentHash === "string"
    && /^[a-f0-9]{64}$/i.test(candidate.documentHash)
    && typeof candidate.reference === "string"
    && /^KRV-LGL-\d{8}-(?:[A-F0-9]{12}|\d{6})$/.test(candidate.reference)
    && typeof candidate.issuedOn === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(candidate.issuedOn)
    && typeof candidate.expiresAt === "number"
    && Number.isSafeInteger(candidate.expiresAt)
    && (candidate.state === "RESERVED" || candidate.state === "SUBMITTED")
    && typeof candidate.attempts === "number"
    && Number.isSafeInteger(candidate.attempts)
    && candidate.attempts >= 1
    && candidate.attempts <= 25
    && typeof candidate.proof === "string"
    && /^[A-Za-z0-9_-]{32,}$/.test(candidate.proof)
  );
}

export function signLegalPrintReservation(reservation: LegalPrintReservation, key: string): string {
  const body = serialise(reservation);
  return `${body}.${signature(body, key)}`;
}

export function verifyLegalPrintReservation(token: string | undefined, key: string, now = Date.now()): LegalPrintReservation | null {
  if (!token) return null;
  const [body, receivedSignature, extra] = token.split(".");
  if (!body || !receivedSignature || extra) return null;
  const expectedSignature = signature(body, key);
  const received = Buffer.from(receivedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const value: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return isReservation(value) && value.expiresAt > now ? value : null;
  } catch {
    return null;
  }
}

export function contentSha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

export function createLegalPrintReservation(input: LegalPrintReservationInput, proof: string, now = new Date()): LegalPrintReservation {
  return {
    version: RESERVATION_VERSION,
    ...input,
    proof,
    expiresAt: now.getTime() + RESERVATION_TTL_SECONDS * 1000,
    state: "RESERVED",
  };
}

/** A submitted browser print request is not evidence of physical printer completion. */
export function submitLegalPrintReservation(reservation: LegalPrintReservation, now = new Date()): LegalPrintReservation {
  return {
    ...reservation,
    state: "SUBMITTED",
    expiresAt: now.getTime() + SUBMITTED_TTL_SECONDS * 1000,
  };
}

export function legalPrintCookieMaxAge(reservation: LegalPrintReservation): number {
  return reservation.state === "SUBMITTED" ? SUBMITTED_TTL_SECONDS : RESERVATION_TTL_SECONDS;
}
