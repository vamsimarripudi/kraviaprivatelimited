import { NextResponse } from "next/server";
import { enquiryInput, enquiryReference, enquiryFingerprint } from "@/lib/enquiry-intake";
import { publicQuotaIdentity } from "@/lib/corporate/public-quota";
import { requestPublicFormReceipt } from "@/lib/corporate/public-form-email";
import { createAdminClient } from "@/lib/supabase/admin";

function hasSameOrigin(request: Request) { const origin = request.headers.get("origin"); if (!origin) return true; try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; } }
export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const result = enquiryInput.safeParse(body); if (!result.success) return NextResponse.json({ error: "Please check the form fields." }, { status: 400 });
  const quotaIdentity = publicQuotaIdentity(request); if (!quotaIdentity) return NextResponse.json({ error: "Contact intake is being configured. Please try again later." }, { status: 503 });
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: "Contact intake is being configured. Please try again later." }, { status: 503 });
  const quota = await supabase.rpc("consume_support_request_quota", { p_scope: "CREATE", p_fingerprint_hash: enquiryFingerprint(quotaIdentity), p_limit: 6 });
  if (quota.error) return NextResponse.json({ error: "Enquiries are temporarily unavailable. Please try again later." }, { status: 503 });
  if (!quota.data) return NextResponse.json({ error: "Please wait before sending another enquiry." }, { status: 429 });
  const savedReference = enquiryReference(result.data); const { error } = await supabase.from("contact_enquiries").insert({ reference: savedReference, category: result.data.category, name: result.data.name, email: result.data.email, organisation: result.data.organisation || null, message: result.data.message, privacy_acknowledged_at: new Date().toISOString(), purpose: "RESPOND_TO_ENQUIRY" });
  let responseStatus = 201;
  if (error?.code === "23505" && result.data.requestId) {
    const existing = await supabase.from("contact_enquiries").select("reference").eq("reference", savedReference).maybeSingle();
    if (!existing.error && existing.data) responseStatus = 200;
    else return NextResponse.json({ error: "We could not record your request. Please try again later." }, { status: 503 });
  }
  else if (error) return NextResponse.json({ error: "We could not record your request. Please try again later." }, { status: 503 });

  await requestPublicFormReceipt({
    eventId: `public-contact:${savedReference}`,
    formKind: "CONTACT",
    reference: savedReference,
    recipientEmail: result.data.email,
    recipientName: result.data.name,
  });
  return NextResponse.json({ reference: savedReference }, { status: responseStatus });
}
