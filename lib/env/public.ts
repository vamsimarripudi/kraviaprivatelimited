import { z } from "zod";

const localSiteUrl = "http://localhost:3000";
export const canonicalProductionSiteUrl = "https://www.kraviaprivatelimited.com";

/**
 * Produces a valid server-rendering base URL without accepting a production
 * canonical URL in preview deployments.
 */
export function resolvePublicSiteUrl(value = process.env.NEXT_PUBLIC_SITE_URL, runtime = process.env): string {
  if (runtime.VERCEL_ENV === "preview" && runtime.VERCEL_URL) return `https://${runtime.VERCEL_URL}`;

  const candidate = value?.trim();
  if (!candidate) return runtime.VERCEL_ENV === "production" ? canonicalProductionSiteUrl : localSiteUrl;

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

function asHttpUrl(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  if (!candidate) return undefined;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads browser-safe configuration without making a malformed local integration
 * value an outage for public pages. Protected routes still call the explicit
 * require helper and therefore fail closed when Supabase is needed.
 */
export function getPublicEnvironment(): PublicEnvironment {
  const url = asHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || undefined;
  return publicEnvironmentSchema.parse({
    NEXT_PUBLIC_SITE_URL: resolvePublicSiteUrl(),
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
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