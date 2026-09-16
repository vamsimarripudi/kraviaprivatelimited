import "server-only";
import { z } from "zod";

const officeEnvironmentSchema = z.object({
  OFFICE_SUPABASE_URL: z.string().url(),
  OFFICE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type OfficeEnvironment = z.infer<typeof officeEnvironmentSchema>;

/**
 * KRAVIA Office uses a dedicated Supabase Auth tenant. These variables are
 * intentionally server-only so the main public-site Supabase configuration and
 * the internal Office identity boundary can never be mixed accidentally.
 */
export function getOfficeEnvironment(): OfficeEnvironment | null {
  const url = process.env.OFFICE_SUPABASE_URL?.trim();
  const publishableKey = process.env.OFFICE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;

  const parsed = officeEnvironmentSchema.safeParse({
    OFFICE_SUPABASE_URL: url,
    OFFICE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  });
  return parsed.success ? parsed.data : null;
}

export function requireOfficeEnvironment(): OfficeEnvironment {
  const environment = getOfficeEnvironment();
  if (!environment) {
    throw new Error("KRAVIA Office identity is not configured. Set OFFICE_SUPABASE_URL and OFFICE_SUPABASE_PUBLISHABLE_KEY.");
  }
  return environment;
}

/**
 * Private/canonical FastAPI runtime used by the path-based /office and /finance
 * BFF. The browser never receives this origin; it calls same-origin Next routes.
 */
export function getOfficeRuntimeOrigin(): string | null {
  const candidate = process.env.OFFICE_API_ORIGIN?.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}
