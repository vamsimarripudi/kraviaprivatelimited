import { NextResponse } from "next/server";
import { clearOfficeLoginDeviceCookie, getPendingOfficeDeviceApproval, OfficeApiError } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin device approval request is not allowed" }, { status: 403 });
  }
  try {
    const approval = await getPendingOfficeDeviceApproval();
    if (["DECLINED", "EXPIRED", "DELIVERY_FAILED", "DELIVERY_UNKNOWN"].includes(approval.status)) {
      await clearOfficeLoginDeviceCookie();
    }
    return NextResponse.json(
      { status: approval.status, expires_at: approval.expiresAt, device_label: approval.deviceLabel },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof OfficeApiError && [401, 404, 410].includes(error.status)) await clearOfficeLoginDeviceCookie();
    const detail = error instanceof Error ? error.message : "Unable to check device approval";
    const status = error instanceof OfficeApiError ? error.status : 503;
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
