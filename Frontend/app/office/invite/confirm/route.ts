import { NextRequest, NextResponse } from "next/server";
import { acceptOfficeInvitation } from "@/lib/office/access-recovery";
import { signOutOffice, verifyOfficeInviteToken } from "@/lib/office/auth-server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (!tokenHash || type !== "invite") return NextResponse.redirect(new URL("/office/login?reason=invite_invalid", request.url), 303);

  let context;
  try {
    context = await verifyOfficeInviteToken(tokenHash);
    const accepted = await acceptOfficeInvitation(context.identity.userId);
    if (!accepted) {
      await signOutOffice(context);
      return NextResponse.redirect(new URL("/office/login?reason=invite_invalid", request.url), 303);
    }
    return NextResponse.redirect(new URL("/office/activate", request.url), 303);
  } catch {
    if (context) { try { await signOutOffice(context); } catch { /* fail closed */ } }
    return NextResponse.redirect(new URL("/office/login?reason=invite_invalid", request.url), 303);
  }
}
