import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getOfficeSessionContext,
  listOfficeAuthSessions,
  officeIdentityIsProvisioned,
  revokeOfficeAuthSession,
} from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const revokeSchema = z.object({ session_id: z.string().uuid() });

async function aal2Context() {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity) || context.identity.aal !== "aal2") return null;
  return context;
}

export async function GET() {
  const context = await aal2Context();
  if (!context) {
    return NextResponse.json(
      { detail: "AAL2 Office session required" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    return NextResponse.json(await listOfficeAuthSessions(context), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to load Office sessions";
    return NextResponse.json({ detail }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin session revocation is not allowed" }, { status: 403 });
  }
  const context = await aal2Context();
  if (!context) {
    return NextResponse.json({ detail: "AAL2 Office session required" }, { status: 401 });
  }
  const parsed = revokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ detail: "Invalid Office session revocation request" }, { status: 400 });
  }
  try {
    const result = await revokeOfficeAuthSession(context, parsed.data.session_id);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to revoke Office session";
    return NextResponse.json({ detail }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
}
