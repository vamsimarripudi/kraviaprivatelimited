import { NextResponse } from "next/server";
import { enquiryInput, enquiryReference, enquiryFingerprint } from "@/lib/enquiry-intake";
import { createAdminClient } from "@/lib/supabase/admin";

function hasSameOrigin(request: Request) { const origin = request.headers.get("origin"); if (!origin) return true; try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; } }
export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const result = enquiryInput.safeParse(body); if (!result.success) return NextResponse.json({ error: "Please check the form fields." }, { status: 400 });
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: "Contact intake is being configured. Please try again later." }, { status: 503 });
  const quota = await supabase.rpc("consume_support_request_quota", { p_scope: "CREATE", p_fingerprint_hash: enquiryFingerprint(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"), p_limit: 6 });
  if (quota.error) return NextResponse.json({ error: "Enquiries are temporarily unavailable. Please try again later." }, { status: 503 });
  if (!quota.data) return NextResponse.json({ error: "Please wait before sending another enquiry." }, { status: 429 });
  const savedReference = enquiryReference(result.data); const { error } = await supabase.from("contact_enquiries").insert({ reference: savedReference, category: result.data.category, name: result.data.name, email: result.data.email, organisation: result.data.organisation || null, message: result.data.message, privacy_acknowledged_at: new Date().toISOString(), purpose: "RESPOND_TO_ENQUIRY" });
  if (error?.code === "23505" && result.data.requestId) {
    const existing = await supabase.from("contact_enquiries").select("reference").eq("reference", savedReference).maybeSingle();
    if (!existing.error && existing.data) return NextResponse.json({ reference: savedReference }, { status: 200 });
  }
  if (error) return NextResponse.json({ error: "We could not record your request. Please try again later." }, { status: 503 });
  return NextResponse.json({ reference: savedReference }, { status: 201 });
}
