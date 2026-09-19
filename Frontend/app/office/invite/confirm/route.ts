import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/office/login?reason=invite_invalid", request.url), 303);
}
