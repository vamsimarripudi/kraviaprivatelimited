import { NextResponse } from "next/server";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import { getMyOfficeAuthSessions } from "@/lib/office/auth-session-server";

export async function GET() {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity) || context.identity.aal !== "aal2") {
    return NextResponse.json({ detail: "AAL2 Office session required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    return NextResponse.json({ sessions: await getMyOfficeAuthSessions(context) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ detail: "Unable to load Office session history" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
