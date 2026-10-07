import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decideOfficeDeviceApprovalFromEmail, OFFICE_DEVICE_ACTION_COOKIE, OfficeApiError } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

function readActionCookie(value: string | undefined) {
  if (!value) return null;
  const [approvalId, actionToken] = value.split(".");
  if (!/^[0-9a-f-]{36}$/i.test(approvalId ?? "") || !/^[A-Za-z0-9_-]{32,}$/.test(actionToken ?? "")) return null;
  return { approvalId, actionToken };
}

function readDecision(value: unknown): "APPROVE" | "DECLINE" | null {
  if (!value || typeof value !== "object") return null;
  const decision = (value as { decision?: unknown }).decision;
  return decision === "APPROVE" || decision === "DECLINE" ? decision : null;
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
  const decision = readDecision(await request.json().catch(() => null));
  if (!decision) {
    return NextResponse.json({ detail: "Choose whether to trust or block this device" }, { status: 400 });
  }
  try {
    const result = await decideOfficeDeviceApprovalFromEmail({ ...action, decision });
    clear();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    clear();
    const detail = error instanceof Error ? error.message : "Unable to decide this device request";
    const status = error instanceof OfficeApiError ? error.status : 503;
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
