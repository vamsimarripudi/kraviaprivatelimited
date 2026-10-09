import { NextResponse } from "next/server";
import { cancelPendingOfficeQrSignin } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Authenticator approval request is not allowed" }, { status: 403 });
  }
  await cancelPendingOfficeQrSignin();
  return NextResponse.json({ cancelled: true }, { headers: { "Cache-Control": "no-store" } });
}
