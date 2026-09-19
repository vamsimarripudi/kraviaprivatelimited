import { NextResponse } from "next/server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin request rejected" }, { status: 403 });
  }
  return NextResponse.json(
    { detail: "Office recovery is administrator-assisted. Contact the Founder or an authorised Office administrator." },
    { status: 409, headers: { "Cache-Control": "no-store" } },
  );
}
