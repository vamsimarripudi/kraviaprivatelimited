import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashTrackingCode } from "@/lib/corporate/support";

const tracker = z.object({ reference: z.string().trim().regex(/^KRV-SUP-[A-Z0-9]{8}$/), trackingCode: z.string().trim().regex(/^[A-Z0-9]{12}$/) });
export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const input = tracker.safeParse({ reference: typeof raw?.reference === "string" ? raw.reference.trim().toUpperCase() : raw?.reference, trackingCode: typeof raw?.trackingCode === "string" ? raw.trackingCode.trim().toUpperCase() : raw?.trackingCode });
  if (!input.success) return NextResponse.json({ error: "Enter the case reference and 12-character tracking code." }, { status: 400 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Case tracking is being configured. Please try again later." }, { status: 503 });
  const fingerprint = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const quota = await supabase.rpc("consume_support_request_quota", { p_scope: "TRACK", p_fingerprint_hash: await hashTrackingCode(`track:${fingerprint}`), p_limit: 12 });
  if (quota.error) return NextResponse.json({ error: "Case tracking is temporarily unavailable." }, { status: 503 });
  if (!quota.data) return NextResponse.json({ error: "Too many tracking attempts. Please wait before trying again." }, { status: 429 });
  const trackingSecretHash = await hashTrackingCode(input.data.trackingCode);
  const { data: supportCase, error } = await supabase.from("support_cases").select("id,reference,category,subject,status,priority,created_at,last_customer_visible_update_at").eq("reference", input.data.reference).eq("tracking_secret_hash", trackingSecretHash).maybeSingle();
  if (error) return NextResponse.json({ error: "Case tracking is temporarily unavailable." }, { status: 503 });
  if (!supportCase) return NextResponse.json({ error: "We could not verify that reference and tracking code." }, { status: 404 });
  const { data: updates, error: updatesError } = await supabase.from("support_case_updates").select("body,created_at").eq("case_id", supportCase.id).eq("customer_visible", true).order("created_at", { ascending: true });
  if (updatesError) return NextResponse.json({ error: "Case tracking is temporarily unavailable." }, { status: 503 });
  return NextResponse.json({ case: { ...supportCase, updates: updates ?? [] } }, { headers: { "Cache-Control": "no-store" } });
}