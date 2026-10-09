/**
 * The action token arrives through a top-level navigation from the account
 * owner's mailbox. Lax keeps it available for that one safe navigation while
 * the action itself still requires a same-origin POST and server validation.
 *
 * The API owns the exact request expiry (5–60 minutes). The browser cookie is
 * only a transport bound and therefore uses the API's maximum permitted
 * lifetime; an expired server request cannot be reviewed or decided.
 */
export const DEVICE_APPROVAL_ACTION_COOKIE_MAX_AGE_SECONDS = 60 * 60;

export function deviceApprovalActionCookieOptions(maxAge = DEVICE_APPROVAL_ACTION_COOKIE_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
