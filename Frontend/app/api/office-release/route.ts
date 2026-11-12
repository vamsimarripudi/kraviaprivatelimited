import { NextResponse } from "next/server";

// Public, read-only release fingerprint. No auth identity, tokens, environment
// secrets or private user data are exposed. Allows the custom domain to be
// checked directly instead of treating an ignored Vercel build as a release.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    {
      application: "KRAVIA Office",
      release: "2026-11-12-login-refresh",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "unavailable",
      environment: process.env.VERCEL_ENV || "unknown",
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
