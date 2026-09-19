import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Legacy Corporate Office activity endpoint is retired. Use KRAVIA Office." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
