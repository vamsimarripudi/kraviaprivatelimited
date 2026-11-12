import { NextResponse } from "next/server";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request))
    return NextResponse.json({ detail: "Cross-origin request rejected" }, { status: 403 });
  const ctx = await getOfficeSessionContext();
  if (!ctx || !officeIdentityIsProvisioned(ctx.identity))
    return NextResponse.json({ detail: "Office sign-in is required" }, { status: 401 });
  if (ctx.identity.aal !== "aal2")
    return NextResponse.json({ detail: "MFA verification is required" }, { status: 403 });
  const origin = getOfficeRuntimeOrigin();
  if (!origin)
    return NextResponse.json({ detail: "KRAVIA Office identity backend is not configured" }, { status: 503 });
  try {
    const response = await fetch(new URL("/api/v1/auth/workspace-activation/request", origin), {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.session.access_token}`, Accept: "application/json" },
      redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(25_000),
    });
    const body = await response.json().catch(() => ({}));
    return NextResponse.json(body, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ detail: "KRAVIA Office backend could not confirm the activation request" }, { status: 503 });
  }
}
