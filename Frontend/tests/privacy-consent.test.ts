import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePrivacyChoices, privacyCookieFromDocument, privacyPreferenceVersion, serialisePrivacyChoices } from "../lib/privacy/choices";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const optionalAnalytics = readFileSync(new URL("../components/optional-analytics.tsx", import.meta.url), "utf8");
const consentRoute = readFileSync(new URL("../app/api/privacy/consent/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../Database/supabase/migrations/202610060003_web_privacy_preferences.sql", import.meta.url), "utf8");

describe("website privacy preference controls", () => {
  it("uses a non-identifying browser preference value and rejects unknown versions", () => {
    const cookie = serialisePrivacyChoices({ version: privacyPreferenceVersion, optionalAnalytics: true });
    expect(cookie).toBe(`${privacyPreferenceVersion}.optional`);
    expect(parsePrivacyChoices(cookie)).toEqual({ version: privacyPreferenceVersion, optionalAnalytics: true });
    expect(parsePrivacyChoices("2020-01-01.optional")).toBeNull();
    expect(privacyCookieFromDocument(`other=value; kravia_privacy_choices=${privacyPreferenceVersion}.necessary`)).toEqual({ version: privacyPreferenceVersion, optionalAnalytics: false });
  });

  it("does not mount optional analytics before a stored affirmative choice and respects Global Privacy Control", () => {
    expect(layout).toContain("<CookiePreferences />");
    expect(layout).toContain("<OptionalAnalytics />");
    expect(layout).not.toContain("<Analytics />");
    expect(optionalAnalytics).toContain("privacyCookieFromDocument(document.cookie)?.optionalAnalytics === true");
    expect(optionalAnalytics).toContain("!globalPrivacyControlActive()");
    expect(optionalAnalytics).toContain("window.addEventListener(\"kravia:privacy-choices\"");
    expect(optionalAnalytics).toContain('if (!enabled)');
    expect(optionalAnalytics).toContain('void import("@vercel/analytics/next")');
    expect(optionalAnalytics).not.toContain('import dynamic');
  });

  it("persists preferences only through a same-origin, keyed server-side route", () => {
    expect(consentRoute).toContain("sameOrigin(request)");
    expect(consentRoute).toContain("KRAVIA_PUBLIC_CONSENT_HMAC_KEY");
    expect(consentRoute).toContain("record_web_privacy_preference");
    expect(consentRoute).toContain("Optional technologies remain off");
    expect(consentRoute).toContain("secure: process.env.NODE_ENV === \"production\"");
  });

  it("keeps preference records private and writes an immutable decision history", () => {
    expect(migration).toContain("create table public.web_privacy_preferences");
    expect(migration).toContain("create table public.web_privacy_preference_events");
    expect(migration).toContain("OPTIONAL_ACCEPTED");
    expect(migration).toContain("PREFERENCE_WITHDRAWN");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("grant execute on function public.record_web_privacy_preference");
    expect(migration).not.toMatch(/create policy[^;]+web_privacy[^;]+using \(true\)/i);
  });
});
