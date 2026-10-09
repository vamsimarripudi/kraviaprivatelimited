import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { OFFICE_DEVICE_ACTION_COOKIE, OfficeApiError, reviewOfficeDeviceApprovalFromEmail } from "@/lib/office/auth-server";
import { deviceApprovalActionCookieOptions } from "@/lib/office/device-approval-action-cookie";

function readActionCookie(value: string | undefined) {
  if (!value) return null;
  const [approvalId, actionToken] = value.split(".");
  if (!/^[0-9a-f-]{36}$/i.test(approvalId ?? "") || !/^[A-Za-z0-9_-]{32,}$/.test(actionToken ?? "")) return null;
  return { approvalId, actionToken };
}

export async function GET() {
  const store = await cookies();
  const clear = () => store.set(OFFICE_DEVICE_ACTION_COOKIE, "", deviceApprovalActionCookieOptions(0));
  const action = readActionCookie(store.get(OFFICE_DEVICE_ACTION_COOKIE)?.value);
  if (!action) {
    clear();
    return NextResponse.json({ detail: "This device approval link is invalid or expired" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const review = await reviewOfficeDeviceApprovalFromEmail(action);
    return NextResponse.json(review, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to review this device request";
    const status = error instanceof OfficeApiError ? error.status : 503;
    if (status === 404 || status === 410) clear();
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
