import { NextResponse } from "next/server";
import { z } from "zod";
import { requestOfficePasswordRecovery } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const requestSchema = z.object({ email: z.string().trim().email().max(320) });

function canonicalRecoveryRedirect(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for production Office recovery");
  }
  const origin = new URL(configured || request.url).origin;
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new Error("Production Office recovery requires HTTPS");
  }
  return new URL("/office/reset-password", origin).toString();
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin request rejected" }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ detail: "Enter a valid Office email address" }, { status: 422 });
  }

  try {
    await requestOfficePasswordRecovery(parsed.data.email.toLowerCase(), canonicalRecoveryRedirect(request));
  } catch {
    return NextResponse.json(
      { detail: "Office recovery is temporarily unavailable. Try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { accepted: true },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
