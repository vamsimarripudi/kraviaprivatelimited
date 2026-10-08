import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { publicQuotaIdentity } from "@/lib/corporate/public-quota";
import { getPublishedContentByPublicPath } from "@/lib/content/repository";
import {
  contentSha256,
  getLegalPrintSigningKey,
  legalPrintCookieMaxAge,
  legalPrintReservationCookieName,
  signLegalPrintReservation,
} from "@/lib/legal/print-reservation";
import { reserveLegalPrintJob } from "@/lib/legal/print-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({ path: z.string().regex(/^\/legal\/[a-z0-9-]+$/) });

function hasSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function setReservationCookie(response: NextResponse, value: string, maxAge: number) {
  response.cookies.set({
    name: legalPrintReservationCookieName,
    value,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/legal/print-jobs",
    maxAge,
  });
}

/** Reserves a durable, server-audited reference before the native print UI opens. */
export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return noStore({ error: "Invalid request origin." }, 403);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStore({ error: "Invalid print request." }, 400);

  const key = getLegalPrintSigningKey();
  if (!key) return noStore({ error: "Legal printing is not configured securely. Please contact KRAVIA." }, 503);

  const record = await getPublishedContentByPublicPath(parsed.data.path);
  if (!record || record.type !== "POLICY") return noStore({ error: "This approved policy is not available for printing." }, 404);

  const result = await reserveLegalPrintJob({
      documentPath: parsed.data.path,
      documentTitle: record.title,
      documentVersion: String(record.version),
      documentHash: contentSha256(record.body),
      visitorIdentity: publicQuotaIdentity(request) ?? "unattributed-production-request",
      signingKey: key,
    });
  if ("failure" in result) {
    if (result.failure === "RATE_LIMIT") return noStore({ error: "Please wait before preparing another print." }, 429);
    return noStore({ error: "Printing is temporarily unavailable. Please try again shortly." }, 503);
  }

  const { reservation } = result;
  const response = noStore({
    jobId: reservation.id,
    referenceNo: reservation.reference,
    issuedOn: reservation.issuedOn,
    attemptCount: reservation.attempts,
  });
  setReservationCookie(response, signLegalPrintReservation(reservation, key), legalPrintCookieMaxAge(reservation));
  return response;
}
