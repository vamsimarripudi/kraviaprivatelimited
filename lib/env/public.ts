import { z } from "zod";

const localSiteUrl = "http://localhost:3000";

/**
 * Ensures server-rendered metadata always has a valid absolute base URL.
 * An empty environment value is common in preview/build environments and must
 * not reach the root layout metadata resolver.
 */
export function resolvePublicSiteUrl(value = process.env.NEXT_PUBLIC_SITE_URL): string {
  const candidate = value?.trim();
  if (!candidate) return localSiteUrl;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : localSiteUrl;
  } catch {
    return localSiteUrl;
  }
}

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type PublicSupabaseEnvironment = Required<Pick<PublicEnvironment, "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY">>;

export function getPublicEnvironment(): PublicEnvironment {
  return publicEnvironmentSchema.parse({
    NEXT_PUBLIC_SITE_URL: resolvePublicSiteUrl(),
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  });
}

export function getPublicSupabaseEnvironment(): PublicSupabaseEnvironment | null {
  const environment = getPublicEnvironment();
  if (!environment.NEXT_PUBLIC_SUPABASE_URL || !environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  return { NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}

export function requirePublicSupabaseEnvironment(): PublicSupabaseEnvironment {
  const environment = getPublicSupabaseEnvironment();
  if (!environment) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.");
  return environment;
}
