import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashTrackingCode } from "@/lib/corporate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reservationCookie = "kravia_legal_print_job";
const input = z.object({ status: z.enum(["PRINTED", "RETRY"]) });
type Props = { params: Promise<{ jobId: string }> };

function hasSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function PATCH(request: NextRequest, { params }: Props) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { jobId } = await params;
  const parsedId = z.string().uuid().safeParse(jobId);
  const parsedBody = input.safeParse(await request.json().catch(() => null));
  const token = request.cookies.get(reservationCookie)?.value;
  const admin = createAdminClient();
  if (!parsedId.success || !parsedBody.success || !token) return NextResponse.json({ error: "Invalid print confirmation." }, { status: 400 });
  if (!admin) return NextResponse.json({ error: "Document print records are temporarily unavailable. Please try again later." }, { status: 503 });

  const tokenHash = await hashTrackingCode(`legal-print-job:${token}`);
  const result = await admin.rpc("confirm_legal_print_job", {
    p_job_id: parsedId.data,
    p_reservation_token_hash: tokenHash,
    p_printed: parsedBody.data.status === "PRINTED",
  });
  if (result.error) return NextResponse.json({ error: "Document print records are temporarily unavailable. Please try again later." }, { status: 503 });
  if (!result.data) return NextResponse.json({ error: "This print confirmation has expired. Prepare the document again." }, { status: 403 });

  const response = NextResponse.json({ status: parsedBody.data.status }, { headers: { "Cache-Control": "no-store" } });
  if (parsedBody.data.status === "PRINTED") response.cookies.delete({ name: reservationCookie, path: "/api/legal/print-jobs" });
  return response;
}
