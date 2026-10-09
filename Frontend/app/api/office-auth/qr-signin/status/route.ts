import { NextResponse } from "next/server";
import {
  OfficeApiError,
  clearOfficeQrSigninCookie,
  completePendingOfficeQrSignin,
  getPendingOfficeQrSignin,
} from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Authenticator approval request is not allowed" }, { status: 403 });
  }
  try {
    const pending = await getPendingOfficeQrSignin();
    if (pending.status === "APPROVED") {
      const context = await completePendingOfficeQrSignin();
      return NextResponse.json(
        { verified: true, status: "CONSUMED", aal: context.identity.aal },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (["REJECTED", "EXPIRED", "REVOKED", "CONSUMED"].includes(pending.status)) {
      await clearOfficeQrSigninCookie();
    }
    return NextResponse.json(
      {
        verified: false,
        status: pending.status,
        expires_at: pending.expiresAt,
        browser_label: pending.browserLabel,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof OfficeApiError ? error.status : 400;
    const detail = error instanceof Error ? error.message : "Authenticator approval status could not be read";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
