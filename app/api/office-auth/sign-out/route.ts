import { NextResponse } from "next/server";
import { getOfficeSessionContext, signOutOffice } from "@/lib/office/auth-server";

export async function POST() {
  const context = await getOfficeSessionContext();
  await signOutOffice(context);
  return NextResponse.json({ signed_out: true }, { headers: { "Cache-Control": "no-store" } });
}
