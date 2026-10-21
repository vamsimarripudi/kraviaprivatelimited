import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnvironment } from "@/lib/env/server";
import { getOfficeAdminEnvironment } from "@/lib/env/office";

const serviceClientOptions = { auth: { autoRefreshToken: false, persistSession: false } } as const;

// Server-only privileged Supabase client. Never import into Client Components.
export function createAdminClient() {
  const environment = getSupabaseAdminEnvironment();
  if (!environment) return null;
  return createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SECRET_KEY, serviceClientOptions);
}

/**
 * Server-only client for the KRAVIA Office control plane. Legal print
 * reservations live here with their RLS-protected, service-only RPCs; they do
 * not belong to the public website content store.
 */
export function createOfficeAdminClient() {
  const environment = getOfficeAdminEnvironment();
  if (!environment) return null;
  return createClient(environment.OFFICE_SUPABASE_URL, environment.OFFICE_SUPABASE_SECRET_KEY, serviceClientOptions);
}
