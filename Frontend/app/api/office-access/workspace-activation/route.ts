import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.object({ target_user_id: z.string().uuid() });

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request))
    return NextResponse.json({ detail: "Cross-origin request rejected" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid employee ID" }, { status: 400 });
  const ctx = await getOfficeSessionContext();
  if (!ctx || !officeIdentityIsProvisioned(ctx.identity))
    return NextResponse.json({ detail: "Office sign-in is required" }, { status: 401 });
  if (ctx.identity.aal !== "aal2" || !ctx.identity.roles.includes("OWNER"))
    return NextResponse.json({ detail: "Only the verified Founder can approve workspace activation" }, { status: 403 });
  const origin = getOfficeRuntimeOrigin();
  if (!origin)
    return NextResponse.json({ detail: "KRAVIA Office identity backend is not configured" }, { status: 503 });
  try {
    const response = await fetch(
      new URL(`/api/v1/auth/workspace-activation/${parsed.data.target_user_id}/approve`, origin), {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.session.access_token}`, Accept: "application/json" },
        redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(25_000),
      },
    );
    const body = await response.json().catch(() => ({}));
    return NextResponse.json(body, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ detail: "KRAVIA Office backend could not confirm activation" }, { status: 503 });
  }
}
