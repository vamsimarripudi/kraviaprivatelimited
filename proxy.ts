import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

function legacyCorporateDestination(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const section = parts[1];
  if (!section) return "/office";

  const exact: Record<string, string> = {
    login: "/office/login",
    finance: "/finance",
    gst: "/finance/gst",
    auditor: "/finance/audit",
    content: "/admin/newsroom",
  };
  return exact[section] ?? `/office/${section}`;
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/corporate" || request.nextUrl.pathname.startsWith("/corporate/")) {
    const destination = request.nextUrl.clone();
    destination.pathname = legacyCorporateDestination(request.nextUrl.pathname);
    destination.search = "";
    return NextResponse.redirect(destination, 308);
  }
  return updateSession(request);
}

export const config = { matcher: ["/corporate/:path*", "/admin/:path*"] };
