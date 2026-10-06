import "server-only";
import { neon } from "@neondatabase/serverless";
import { getWebsiteConsentDatabaseUrl } from "@/lib/env/server";

type StoreInput = {
  preferenceFingerprint: string;
  preferenceVersion: string;
  optionalAnalytics: boolean;
  globalPrivacyControl: boolean;
  quotaFingerprint: string;
};

type PreferenceResult = { preference_id: string | null };

export type PrivacyPreferenceStoreResult = "STORED" | "RATE_LIMITED" | "UNAVAILABLE";

/**
 * Records a pseudonymous preference and consumes the request quota in one
 * database function. The browser never receives database credentials and
 * callers must fail closed when the store is unavailable.
 */
export async function recordWebsitePrivacyPreference(input: StoreInput): Promise<PrivacyPreferenceStoreResult> {
  const connectionString = getWebsiteConsentDatabaseUrl();
  if (!connectionString) return "UNAVAILABLE";

  try {
    const sql = neon(connectionString);
    const rows = await sql`
      select website_privacy.record_preference(
        ${input.preferenceFingerprint},
        ${input.preferenceVersion},
        ${input.optionalAnalytics},
        ${input.globalPrivacyControl},
        ${input.quotaFingerprint},
        ${12},
        ${60 * 60}
      ) as preference_id
    `;
    const result = rows as PreferenceResult[];
    return result[0]?.preference_id ? "STORED" : "RATE_LIMITED";
  } catch {
    // A database error must never turn optional technologies on.
    return "UNAVAILABLE";
  }
}
