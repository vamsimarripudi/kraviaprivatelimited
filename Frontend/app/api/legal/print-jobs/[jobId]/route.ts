import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  completeLegalPrintReservation,
  getLegalPrintSigningKey,
  legalPrintCookieMaxAge,
  legalPrintReservationCookieName,
  retryLegalPrintReservation,
  signLegalPrintReservation,
  verifyLegalPrintReservation,
} from "@/lib/legal/print-reservation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({ status: z.enum(["PRINTED", "RETRY"]) });
type Props = { params: Promise<{ jobId: string }> };

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

export async function PATCH(request: NextRequest, { params }: Props) {
  if (!hasSameOrigin(request)) return noStore({ error: "Invalid request origin." }, 403);
  const { jobId } = await params;
  const parsedId = z.string().uuid().safeParse(jobId);
  const parsedBody = input.safeParse(await request.json().catch(() => null));
  const key = getLegalPrintSigningKey();
  if (!parsedId.success || !parsedBody.success || !key) return noStore({ error: "Invalid print confirmation." }, 400);

  const reservation = verifyLegalPrintReservation(request.cookies.get(legalPrintReservationCookieName)?.value, key);
  if (!reservation || reservation.id !== parsedId.data) {
    return noStore({ error: "This print confirmation has expired. Prepare the document again." }, 403);
  }

  const updated = parsedBody.data.status === "PRINTED"
    ? completeLegalPrintReservation(reservation)
    : retryLegalPrintReservation(reservation);
  const response = noStore({ status: parsedBody.data.status, referenceNo: updated.reference });
  setReservationCookie(response, signLegalPrintReservation(updated, key), legalPrintCookieMaxAge(updated));
  return response;
}
