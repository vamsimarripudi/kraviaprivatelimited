import { NextResponse } from "next/server";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";

export async function GET() {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity) || context.identity.aal !== "aal2") {
    return NextResponse.json({ detail: "AAL2 Office session required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    {
      sessions: [{
        id: "current",
        status: "ACTIVE",
        aal: context.identity.aal,
        current: true,
        provider: "KRAVIA_FIRST_PARTY",
      }],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
