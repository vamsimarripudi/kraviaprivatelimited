import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decideOfficeDeviceApprovalFromEmail, OFFICE_DEVICE_ACTION_COOKIE, OfficeApiError } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

function readActionCookie(value: string | undefined) {
  if (!value) return null;
  const [approvalId, actionToken, decision] = value.split(".");
  if (!/^[0-9a-f-]{36}$/i.test(approvalId ?? "") || !/^[A-Za-z0-9_-]{32,}$/.test(actionToken ?? "")) return null;
  if (decision !== "approve" && decision !== "decline") return null;
  return { approvalId, actionToken, decision: decision === "approve" ? "APPROVE" as const : "DECLINE" as const };
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin device decision is not allowed" }, { status: 403 });
  }
  const store = await cookies();
  const action = readActionCookie(store.get(OFFICE_DEVICE_ACTION_COOKIE)?.value);
  const clear = () => store.set(OFFICE_DEVICE_ACTION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
  });
  if (!action) {
    clear();
    return NextResponse.json({ detail: "This device approval link is invalid or expired" }, { status: 400 });
  }
  try {
    const result = await decideOfficeDeviceApprovalFromEmail(action);
    clear();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    clear();
    const detail = error instanceof Error ? error.message : "Unable to decide this device request";
    const status = error instanceof OfficeApiError ? error.status : 503;
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
