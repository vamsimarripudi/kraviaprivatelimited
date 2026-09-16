import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnvironment } from "@/lib/env/public";

/** Server Component, Route Handler and Server Action client; returns null during unconfigured local setup. */
export async function createClient() {
  const cookieStore = await cookies();
  const environment = getPublicSupabaseEnvironment();
  if (!environment) return null;
  return createServerClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => { try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot mutate cookies. */ } },
    },
  });
}
