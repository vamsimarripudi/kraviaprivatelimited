import { isIP } from "node:net";

/**
 * Returns a quota identity only from a hosting-provider-controlled source.
 * Browser-supplied forwarding headers are deliberately never considered.
 */
export function publicQuotaIdentity(request: Request): string | null {
  if (!process.env.VERCEL_ENV) return "unattributed-local";
  const value = request.headers.get("x-vercel-forwarded-for")?.trim() || "";
  if (!value || value.includes(",") || !isIP(value)) return null;
  return `vercel-ip:${value}`;
}
