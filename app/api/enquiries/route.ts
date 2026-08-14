import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const enquiry = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(254), category: z.string().trim().min(1).max(100), organisation: z.string().trim().max(160).optional(), message: z.string().trim().min(10).max(4000), privacyAcknowledged: z.literal("true") });
function reference() { return `KRV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; }
function hasSameOrigin(request: Request) { const origin = request.headers.get("origin"); if (!origin) return true; try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; } }
export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const result = enquiry.safeParse(body); if (!result.success) return NextResponse.json({ error: "Please check the form fields." }, { status: 400 });
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: "Contact intake is being configured. Please try again later." }, { status: 503 });
  const enquiryReference = reference(); const { error } = await supabase.from("contact_enquiries").insert({ reference: enquiryReference, category: result.data.category, name: result.data.name, email: result.data.email, organisation: result.data.organisation || null, message: result.data.message, privacy_acknowledged_at: new Date().toISOString(), purpose: "RESPOND_TO_ENQUIRY" });
  if (error) return NextResponse.json({ error: "We could not record your request. Please try again later." }, { status: 503 });
  return NextResponse.json({ reference: enquiryReference }, { status: 201 });
}
