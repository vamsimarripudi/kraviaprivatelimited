import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { detail: "Password changes are controlled by the KRAVIA first-party account workflow" },
    { status: 409, headers: { "Cache-Control": "no-store" } },
  );
}
