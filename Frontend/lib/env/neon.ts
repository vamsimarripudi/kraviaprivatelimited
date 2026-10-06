/**
 * Validates the server-only pooled connection used for public website privacy
 * preferences. Keeping this parser free of environment access makes it
 * testable without ever exposing a database URL to client modules.
 */
export function isWebsiteConsentDatabaseUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 4_096) return false;

  try {
    const url = new URL(value.trim());
    const isPostgres = url.protocol === "postgres:" || url.protocol === "postgresql:";
    const isNeonHost = url.hostname.toLowerCase().endsWith(".neon.tech");
    const isPooled = url.hostname.toLowerCase().includes("-pooler");
    const hasCredentials = Boolean(url.username && url.password);
    return isPostgres && isNeonHost && isPooled && hasCredentials && url.searchParams.get("sslmode") === "require";
  } catch {
    return false;
  }
}
