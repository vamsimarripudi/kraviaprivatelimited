import { NextResponse } from "next/server";
import { clearOfficeLoginDeviceCookie, completePendingOfficeDeviceApproval, OfficeApiError } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin device approval request is not allowed" }, { status: 403 });
  }
  try {
    const context = await completePendingOfficeDeviceApproval();
    return NextResponse.json(
      { verified: true, aal: context.identity.aal },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof OfficeApiError && [401, 404, 409, 410].includes(error.status)) await clearOfficeLoginDeviceCookie();
    const detail = error instanceof Error ? error.message : "Unable to activate the approved device";
    const status = error instanceof OfficeApiError ? error.status : 503;
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
