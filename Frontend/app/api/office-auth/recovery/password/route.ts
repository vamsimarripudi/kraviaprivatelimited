import { NextResponse } from "next/server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin request rejected" }, { status: 403 });
  }
  return NextResponse.json(
    { detail: "Direct recovery-password updates are disabled. Use the controlled KRAVIA Office recovery process." },
    { status: 409, headers: { "Cache-Control": "no-store" } },
  );
}
