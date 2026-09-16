import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnvironment } from "@/lib/env/server";

// Server-only privileged Supabase client. Never import into Client Components.
export function createAdminClient() {
  const environment = getSupabaseAdminEnvironment();
  if (!environment) return null;
  return createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}
