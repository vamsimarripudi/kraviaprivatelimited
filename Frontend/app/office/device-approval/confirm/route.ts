import { NextRequest, NextResponse } from "next/server";
import { OFFICE_DEVICE_ACTION_COOKIE } from "@/lib/office/auth-server";

const decisionValues = new Set(["approve", "decline"]);

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const decision = request.nextUrl.searchParams.get("decision") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[A-Za-z0-9_-]{32,}$/.test(token) || !decisionValues.has(decision)) {
    return NextResponse.redirect(new URL("/office/login?reason=device_approval_invalid", request.url), 303);
  }

  // Loading an email link must not decide a request. Keep the short-lived,
  // one-time secret out of page JavaScript and require a separate same-origin
  // POST from the explicit confirmation screen.
  const response = NextResponse.redirect(new URL(`/office/device-approval?review=${decision}`, request.url), 303);
  response.cookies.set(OFFICE_DEVICE_ACTION_COOKIE, `${id}.${token}.${decision}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    // The confirmation page and the same-origin BFF action use different
    // routes, so this must be visible to both while remaining HttpOnly.
    path: "/",
    maxAge: 10 * 60,
  });
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
