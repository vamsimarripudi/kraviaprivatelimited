import "server-only";
import { z } from "zod";
import { isWebsiteConsentDatabaseUrl } from "@/lib/env/neon";

const serverEnvironmentSchema = z.object({ SUPABASE_SECRET_KEY: z.string().min(1) });
const supabaseAdminEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
});
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type SupabaseAdminEnvironment = z.infer<typeof supabaseAdminEnvironmentSchema>;

export function getServerEnvironment(): ServerEnvironment | null {
  const result = serverEnvironmentSchema.safeParse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined });
  return result.success ? result.data : null;
}

export function getSupabaseAdminEnvironment() {
  // Privileged server routes do not use the browser publishable key. Requiring
  // it here incorrectly turns a configured server-side integration into a
  // production outage when public authentication is intentionally disabled.
  const result = supabaseAdminEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY?.trim() || undefined,
  });
  return result.success ? result.data : null;
}

/** Returns only a verified pooled Neon URL for the isolated website store. */
export function getWebsiteConsentDatabaseUrl(): string | null {
  const value = process.env.KRAVIA_WEBSITE_CONSENT_DATABASE_URL?.trim();
  return isWebsiteConsentDatabaseUrl(value) ? value : null;
}
