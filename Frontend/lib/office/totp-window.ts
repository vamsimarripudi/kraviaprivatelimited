/**
 * Presentation-only view of the same 30-second RFC 6238 window used by the
 * Office identity service. No secret or code is ever present in the browser.
 */
export const OFFICE_TOTP_PERIOD_SECONDS = 30;

export function officeTotpWindow(timestampMs = Date.now()) {
  const epochSeconds = Math.max(0, Math.floor(timestampMs / 1_000));
  const elapsed = epochSeconds % OFFICE_TOTP_PERIOD_SECONDS;
  const remaining = OFFICE_TOTP_PERIOD_SECONDS - elapsed;
  return {
    index: Math.floor(epochSeconds / OFFICE_TOTP_PERIOD_SECONDS),
    remaining,
    progress: remaining / OFFICE_TOTP_PERIOD_SECONDS,
  };
}
