import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { publicQuotaIdentity } from "@/lib/corporate/public-quota";
import { hashTrackingCode } from "@/lib/corporate/support";
import { privacyPreferenceCookieName, privacyPreferenceVersion, serialisePrivacyChoices } from "@/lib/privacy/choices";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const consentInput = z.object({
  optionalAnalytics: z.boolean(),
  globalPrivacyControl: z.boolean(),
}).strict();

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function preferenceFingerprint(identity: string) {
  const key = process.env.KRAVIA_PUBLIC_CONSENT_HMAC_KEY?.trim();
  if (!key || key.length < 32) return null;
  return createHmac("sha256", key).update(`web-privacy:${identity}`, "utf8").digest("hex");
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const input = consentInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Please review your privacy choice." }, { status: 400 });
  if (input.data.globalPrivacyControl && input.data.optionalAnalytics) {
    return NextResponse.json({ error: "Global Privacy Control keeps optional technologies off." }, { status: 400 });
  }

  const identity = publicQuotaIdentity(request);
  const fingerprint = identity ? preferenceFingerprint(identity) : null;
  const admin = createAdminClient();
  if (!identity || !fingerprint || !admin) {
    return NextResponse.json({ error: "Privacy preferences are temporarily unavailable. Optional technologies remain off." }, { status: 503 });
  }

  const quota = await admin.rpc("consume_support_request_quota", {
    p_scope: "CREATE",
    p_fingerprint_hash: await hashTrackingCode(`privacy-preference:${identity}`),
    p_limit: 12,
  });
  if (quota.error) return NextResponse.json({ error: "Privacy preferences are temporarily unavailable. Optional technologies remain off." }, { status: 503 });
  if (!quota.data) return NextResponse.json({ error: "Please wait before updating your privacy choices again." }, { status: 429 });

  const persisted = await admin.rpc("record_web_privacy_preference", {
    p_fingerprint_hash: fingerprint,
    p_preference_version: privacyPreferenceVersion,
    p_optional_analytics: input.data.optionalAnalytics,
    p_global_privacy_control: input.data.globalPrivacyControl,
  });
  if (persisted.error || !persisted.data) {
    return NextResponse.json({ error: "Privacy preferences could not be recorded. Optional technologies remain off." }, { status: 503 });
  }

  const response = NextResponse.json({ preferenceVersion: privacyPreferenceVersion }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set({
    name: privacyPreferenceCookieName,
    value: serialisePrivacyChoices({ version: privacyPreferenceVersion, optionalAnalytics: input.data.optionalAnalytics }),
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}
