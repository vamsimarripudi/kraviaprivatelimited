import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnvironment } from "@/lib/env/public";

function loginRedirect(request: NextRequest, reason?: string) { const login = request.nextUrl.clone(); login.pathname = "/corporate/login"; login.searchParams.set("next", request.nextUrl.pathname); if (reason) login.searchParams.set("reason", reason); return NextResponse.redirect(login); }
/** Optimistic route gate only. Server reads/actions and RLS enforce the actual authorisation boundary. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request }); const isLogin = request.nextUrl.pathname === "/corporate/login"; const environment = getPublicSupabaseEnvironment();
  if (!environment) return isLogin ? response : loginRedirect(request, "configuration_required");
  const supabase = createServerClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => request.cookies.getAll(), setAll: (items) => { items.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!isLogin && !user) return loginRedirect(request);
  if (isLogin && user) { const destination = request.nextUrl.searchParams.get("next"); return NextResponse.redirect(new URL(destination?.startsWith("/corporate") ? destination : "/corporate/dashboard", request.url)); }
  return response;
}
