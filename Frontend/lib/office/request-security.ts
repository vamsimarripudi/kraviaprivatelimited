import type { NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * HttpOnly SameSite=Strict cookies are the primary CSRF boundary. This explicit
 * Origin/Sec-Fetch-Site check is a second fail-closed browser control for state
 * changing Office BFF calls. Non-browser trusted callers may omit both headers.
 */
export function officeMutationIsSameOrigin(request: Request | NextRequest) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const expectedOrigin = new URL(request.url).origin;

  if (origin && origin !== expectedOrigin) return false;
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) return false;
  return true;
}
