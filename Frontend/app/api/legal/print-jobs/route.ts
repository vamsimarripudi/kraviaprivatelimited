import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { publicQuotaIdentity } from "@/lib/corporate/public-quota";
import { hashTrackingCode } from "@/lib/corporate/support";
import { getPublishedContentByPublicPath } from "@/lib/content/repository";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reservationCookie = "kravia_legal_print_job";
const input = z.object({ path: z.string().regex(/^\/legal\/[a-z0-9-]+$/) });

function hasSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isRateLimited(error: { message?: string | null } | null) {
  return error?.message?.includes("LEGAL_PRINT_RATE_LIMIT") === true;
}

/** Reserves an immutable reference before the browser opens its native print UI. */
export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return noStore({ error: "Invalid request origin." }, 403);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStore({ error: "Invalid print request." }, 400);

  const record = await getPublishedContentByPublicPath(parsed.data.path);
  if (!record || record.type !== "POLICY") return noStore({ error: "This approved policy is not available for printing." }, 404);

  const visitorIdentity = publicQuotaIdentity(request);
  const admin = createAdminClient();
  if (!visitorIdentity || !admin) return noStore({ error: "Document print records are temporarily unavailable. Please try again later." }, 503);

  const reservationToken = randomUUID();
  const [fingerprintHash, reservationTokenHash] = await Promise.all([
    hashTrackingCode(`legal-print:${visitorIdentity}`),
    hashTrackingCode(`legal-print-job:${reservationToken}`),
  ]);
  const contentHash = createHash("sha256").update(canonicalJson(record.body)).digest("hex");
  const reserved = await admin.rpc("reserve_legal_print_job", {
    p_document_path: parsed.data.path,
    p_document_title: record.title,
    p_document_version: record.version,
    p_content_sha256: contentHash,
    p_visitor_fingerprint_hash: fingerprintHash,
    p_reservation_token_hash: reservationTokenHash,
  });
  if (reserved.error || !reserved.data?.[0]) {
    return noStore(
      { error: isRateLimited(reserved.error) ? "Please wait before preparing another print." : "Document print records are temporarily unavailable. Please try again later." },
      isRateLimited(reserved.error) ? 429 : 503,
    );
  }

  const job = reserved.data[0] as { job_id: string; reference_no: string; issued_on: string; attempt_count: number };
  const response = noStore({ jobId: job.job_id, referenceNo: job.reference_no, issuedOn: job.issued_on, attemptCount: job.attempt_count });
  response.cookies.set({
    name: reservationCookie,
    value: reservationToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/legal/print-jobs",
    maxAge: 15 * 60,
  });
  return response;
}
