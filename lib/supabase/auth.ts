import "server-only";
import { createClient } from "@/lib/supabase/server";

export class SupabaseAuthenticationError extends Error {
  constructor(message: string, public readonly code: "CONFIGURATION_REQUIRED" | "UNAUTHENTICATED") { super(message); }
}

/** Trusted server-side identity; never accept a user ID supplied by a browser request. */
export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  if (!supabase) throw new SupabaseAuthenticationError("Supabase is not configured.", "CONFIGURATION_REQUIRED");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new SupabaseAuthenticationError("Sign in is required.", "UNAUTHENTICATED");
  return { supabase, user: data.user };
}
