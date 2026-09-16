import { createBrowserClient } from "@supabase/ssr";
import { requirePublicSupabaseEnvironment } from "@/lib/env/public";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

/** Browser client uses only the publishable key; RLS remains the data boundary. */
export function createBrowserSupabaseClient() {
  if (!browserClient) {
    const environment = requirePublicSupabaseEnvironment();
    browserClient = createBrowserClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  }
  return browserClient;
}
