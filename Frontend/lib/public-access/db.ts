import "server-only";
import { neon } from "@neondatabase/serverless";
import { isWebsiteConsentDatabaseUrl } from "@/lib/env/neon";

/** Public visitor data must never share the Office or anonymous privacy database. */
export function publicAccessSql() {
  const connection = process.env.KRAVIA_PUBLIC_ACCESS_DATABASE_URL?.trim();
  if (!isWebsiteConsentDatabaseUrl(connection)) throw new Error("Public accounts are not configured.");
  if (connection === process.env.KRAVIA_WEBSITE_CONSENT_DATABASE_URL?.trim()) {
    throw new Error("Public access database is not isolated from website privacy.");
  }
  return neon(connection);
}
