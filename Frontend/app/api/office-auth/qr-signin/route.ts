import { NextResponse } from "next/server";
import { OfficeApiError, getOfficeSessionContext, officeIdentityIsProvisioned, startOfficeQrSignin } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Authenticator approval request is not allowed" }, { status: 403 });
  }
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) {
    return NextResponse.json({ detail: "Office sign-in required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const started = await startOfficeQrSignin(context);
    return NextResponse.json(
      {
        request_id: started.requestId,
        status: started.status,
        expires_at: started.expiresAt,
        browser_label: started.browserLabel,
        qr_payload: started.qrPayload,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof OfficeApiError ? error.status : 400;
    const detail = error instanceof Error ? error.message : "Authenticator approval could not be started";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
