import "server-only";
import { z } from "zod";

const officeBaseEnvironmentSchema = z.object({
  OFFICE_SUPABASE_URL: z.string().url(),
  OFFICE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const officeEnvironmentSchema = officeBaseEnvironmentSchema.extend({
  OFFICE_SUPABASE_SECRET_KEY: z.string().min(20).optional(),
});

const officeAdminEnvironmentSchema = officeBaseEnvironmentSchema.extend({
  OFFICE_SUPABASE_SECRET_KEY: z.string().min(20),
});

export type OfficeEnvironment = z.infer<typeof officeEnvironmentSchema>;
export type OfficeAdminEnvironment = z.infer<typeof officeAdminEnvironmentSchema>;

/**
 * KRAVIA Office uses a dedicated Supabase Auth tenant. These variables are
 * intentionally server-only so the public-site Supabase configuration and the
 * internal Office identity boundary can never be mixed accidentally.
 */
export function getOfficeEnvironment(): OfficeEnvironment | null {
  const url = process.env.OFFICE_SUPABASE_URL?.trim();
  const publishableKey = process.env.OFFICE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.OFFICE_SUPABASE_SECRET_KEY?.trim() || undefined;
  if (!url || !publishableKey) return null;

  const parsed = officeEnvironmentSchema.safeParse({
    OFFICE_SUPABASE_URL: url,
    OFFICE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    OFFICE_SUPABASE_SECRET_KEY: secretKey,
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
 * Secret-key access is used only in trusted server code for invite/user/role
 * administration and authoritative current-role checks. The key must never be
 * returned to the browser or stored in source control.
 */
export function getOfficeAdminEnvironment(): OfficeAdminEnvironment | null {
  const environment = getOfficeEnvironment();
  if (!environment?.OFFICE_SUPABASE_SECRET_KEY) return null;
  const parsed = officeAdminEnvironmentSchema.safeParse(environment);
  return parsed.success ? parsed.data : null;
}

export function requireOfficeAdminEnvironment(): OfficeAdminEnvironment {
  const environment = getOfficeAdminEnvironment();
  if (!environment) {
    throw new Error("KRAVIA Office access administration is not configured. Set OFFICE_SUPABASE_SECRET_KEY on the trusted server runtime.");
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
