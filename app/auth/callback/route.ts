import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseEnvironment } from "@/lib/env/public";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const destination = next?.startsWith("/corporate") ? next : "/corporate/dashboard";
  const response = NextResponse.redirect(new URL(destination, request.url));
  const environment = getPublicSupabaseEnvironment();
  const code = request.nextUrl.searchParams.get("code");
  if (!environment || !code) return response;
  const supabase = createServerClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) },
  });
  await supabase.auth.exchangeCodeForSession(code);
  return response;
}
