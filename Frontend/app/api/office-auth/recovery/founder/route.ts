import { NextResponse } from "next/server";
import { z } from "zod";
import { issueFounderBreakGlassRecovery } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.object({
  recovery_key: z.string().min(48).max(512),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Founder recovery is not allowed" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ detail: "Invalid Founder recovery request" }, { status: 400 });
  }
  try {
    const result = await issueFounderBreakGlassRecovery(parsed.data.recovery_key, parsed.data.reason);
    return NextResponse.json(
      {
        issued: true,
        recovery_url: result.recovery_path,
        expires_in: result.expires_in,
        revoked_sessions: result.revoked_sessions,
        mfa_reset: result.mfa_reset,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Founder recovery failed";
    return NextResponse.json({ detail }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
}
