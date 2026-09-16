import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupportReference, createTrackingCode, hashTrackingCode, type SupportCaseQueue } from "@/lib/corporate/support";

export const supportIntakeFields = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  organisation: z.string().trim().max(160).optional(),
  subject: z.string().trim().min(4).max(180),
  description: z.string().trim().min(10).max(8000),
  privacyAcknowledged: z.literal("true"),
  website: z.string().max(0).optional(),
});

export type SupportIntakeDetails = {
  category: string;
  queue: SupportCaseQueue;
  requestKind: string;
  source: "PUBLIC_SUPPORT" | "TRUST_CENTER" | "DPDP_PORTAL" | "SECURITY_REPORTING";
  rateLimit: number;
};

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

function requestFingerprint(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function submitSupportIntake(request: Request, input: unknown, details: SupportIntakeDetails) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const result = supportIntakeFields.safeParse(input);
  if (!result.success) return NextResponse.json({ error: "Please review the required request details." }, { status: 400 });
  if (result.data.website) return NextResponse.json({ reference: "received" }, { status: 201 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "This request channel is being configured. Please try again later." }, { status: 503 });

  const quota = await supabase.rpc("consume_support_request_quota", {
    p_scope: "CREATE",
    p_fingerprint_hash: await hashTrackingCode(`create:${details.queue}:${requestFingerprint(request)}`),
    p_limit: details.rateLimit,
  });
  if (quota.error) return NextResponse.json({ error: "This request channel is temporarily unavailable." }, { status: 503 });
  if (!quota.data) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429 });

  const reference = createSupportReference();
  const trackingCode = createTrackingCode();
  const { error } = await supabase.rpc("create_support_case", {
    p_reference: reference,
    p_tracking_secret_hash: await hashTrackingCode(trackingCode),
    p_requester_name: result.data.name,
    p_requester_email: result.data.email,
    p_organisation: result.data.organisation || "",
    p_category: details.category,
    p_subject: result.data.subject,
    p_description: result.data.description,
    p_queue: details.queue,
    p_request_kind: details.requestKind,
    p_source: details.source,
  });
  if (error) return NextResponse.json({ error: "We could not record your request. Please try again later." }, { status: 503 });
  return NextResponse.json({ reference, trackingCode }, { status: 201, headers: { "Cache-Control": "no-store" } });
}