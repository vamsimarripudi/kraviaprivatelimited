import "server-only";
import { z } from "zod";
import { isWebsiteConsentDatabaseUrl } from "@/lib/env/neon";
import { getPublicSupabaseEnvironment } from "@/lib/env/public";

const serverEnvironmentSchema = z.object({ SUPABASE_SECRET_KEY: z.string().min(1) });
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function getServerEnvironment(): ServerEnvironment | null {
  const result = serverEnvironmentSchema.safeParse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined });
  return result.success ? result.data : null;
}

export function getSupabaseAdminEnvironment() {
  const publicEnvironment = getPublicSupabaseEnvironment();
  const serverEnvironment = getServerEnvironment();
  if (!publicEnvironment || !serverEnvironment) return null;
  return { ...publicEnvironment, ...serverEnvironment };
}

/** Returns only a verified pooled Neon URL for the isolated website store. */
export function getWebsiteConsentDatabaseUrl(): string | null {
  const value = process.env.KRAVIA_WEBSITE_CONSENT_DATABASE_URL?.trim();
  return isWebsiteConsentDatabaseUrl(value) ? value : null;
}
