import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "Legacy Corporate document upload is retired. Use KRAVIA Office governed document workflows." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
