import { NextResponse, type NextRequest } from "next/server";
import { verifyOfficeRecoveryToken } from "@/lib/office/auth-server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash")?.trim();
  const type = request.nextUrl.searchParams.get("type")?.trim();
  if (!tokenHash || type !== "recovery") {
    return NextResponse.redirect(new URL("/office/login?reason=recovery_invalid", request.url), 303);
  }

  try {
    await verifyOfficeRecoveryToken(tokenHash);
    return NextResponse.redirect(new URL("/office/reset-password", request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/office/login?reason=recovery_invalid", request.url), 303);
  }
}
