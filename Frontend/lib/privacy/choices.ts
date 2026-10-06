export const privacyPreferenceCookieName = "kravia_privacy_choices";
export const privacyPreferenceVersion = "2026-10-06";

export type PrivacyChoices = {
  version: typeof privacyPreferenceVersion;
  optionalAnalytics: boolean;
};

/**
 * The browser cookie intentionally contains no identifier or personal data.
 * The signed server-side record is the auditable preference record.
 */
export function serialisePrivacyChoices(choices: PrivacyChoices) {
  return `${choices.version}.${choices.optionalAnalytics ? "optional" : "necessary"}`;
}

export function parsePrivacyChoices(value: string | null | undefined): PrivacyChoices | null {
  if (!value) return null;
  const [version, setting, ...unexpected] = value.split(".");
  if (unexpected.length || version !== privacyPreferenceVersion) return null;
  if (setting === "optional") return { version: privacyPreferenceVersion, optionalAnalytics: true };
  if (setting === "necessary") return { version: privacyPreferenceVersion, optionalAnalytics: false };
  return null;
}

export function privacyCookieFromDocument(cookie: string) {
  const prefix = `${privacyPreferenceCookieName}=`;
  const item = cookie.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(prefix));
  if (!item) return null;
  return parsePrivacyChoices(decodeURIComponent(item.slice(prefix.length)));
}
