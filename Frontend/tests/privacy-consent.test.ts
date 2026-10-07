import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isWebsiteConsentDatabaseUrl } from "../lib/env/neon";
import { parsePrivacyChoices, privacyCookieFromDocument, privacyPreferenceVersion, serialisePrivacyChoices } from "../lib/privacy/choices";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const optionalAnalytics = readFileSync(new URL("../components/optional-analytics.tsx", import.meta.url), "utf8");
const cookiePreferences = readFileSync(new URL("../components/cookie-preferences.tsx", import.meta.url), "utf8");
const consentRoute = readFileSync(new URL("../app/api/privacy/consent/route.ts", import.meta.url), "utf8");
const preferenceStore = readFileSync(new URL("../lib/corporate/privacy-preference-store.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../Database/neon/migrations/202610060001_website_privacy_preferences.sql", import.meta.url), "utf8");

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

  it("offers equal first-layer choices, a granular manager, and no persistent floating reopen control", () => {
    expect(cookiePreferences).toContain("Accept optional analytics");
    expect(cookiePreferences).toContain("Reject optional analytics");
    expect(cookiePreferences).toContain("Manage cookies");
    expect(cookiePreferences).toContain("Optional analytics");
    expect(cookiePreferences).toContain('window.addEventListener("kravia:open-privacy-choices"');
    expect(cookiePreferences).not.toContain("styles.reopen");
  });

  it("persists preferences only through a same-origin, keyed server-side route", () => {
    expect(consentRoute).toContain("sameOrigin(request)");
    expect(consentRoute).toContain("KRAVIA_PUBLIC_CONSENT_HMAC_KEY");
    expect(consentRoute).toContain("recordWebsitePrivacyPreference");
    expect(consentRoute).not.toContain("createAdminClient");
    expect(consentRoute).toContain("Optional technologies remain off");
    expect(consentRoute).toContain("secure: process.env.NODE_ENV === \"production\"");
  });

  it("accepts only a pooled, TLS-protected Neon URL as a server configuration", () => {
    expect(isWebsiteConsentDatabaseUrl("postgresql://role:password@ep-example-123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require")).toBe(true);
    expect(isWebsiteConsentDatabaseUrl("postgresql://role:password@ep-example-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require")).toBe(false);
    expect(isWebsiteConsentDatabaseUrl("postgresql://role:password@ep-example-123-pooler.ap-southeast-1.aws.neon.tech/neondb")).toBe(false);
    expect(isWebsiteConsentDatabaseUrl("https://example.com")).toBe(false);
  });

  it("keeps preference records private, atomically rate limited, and event audited", () => {
    expect(preferenceStore).toContain('import "server-only"');
    expect(preferenceStore).toContain("website_privacy.record_preference");
    expect(preferenceStore).toContain("return \"UNAVAILABLE\"");
    expect(migration).toContain("create schema if not exists website_privacy");
    expect(migration).toContain("create table website_privacy.preferences");
    expect(migration).toContain("create table website_privacy.preference_events");
    expect(migration).toContain("create table website_privacy.rate_windows");
    expect(migration).toContain("OPTIONAL_ACCEPTED");
    expect(migration).toContain("PREFERENCE_WITHDRAWN");
    expect(migration).toContain("on conflict (scope, fingerprint_hash) do update");
    expect(migration).toContain("revoke all on schema website_privacy from public");
    expect(migration).toContain("revoke all on all tables in schema website_privacy from public");
    expect(migration).toContain("revoke all on function website_privacy.record_preference");
  });
});
