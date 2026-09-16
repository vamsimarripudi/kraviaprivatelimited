import { NextResponse } from "next/server";
import { getOfficeSessionContext, signOutOffice } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Office sign-out is not allowed" }, { status: 403 });
  }
  const context = await getOfficeSessionContext();
  await signOutOffice(context);
  return NextResponse.json({ signed_out: true }, { headers: { "Cache-Control": "no-store" } });
}
