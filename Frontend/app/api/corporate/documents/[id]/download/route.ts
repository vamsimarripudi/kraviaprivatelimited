import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Legacy Corporate document delivery is retired. Use KRAVIA Office governed document workflows." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
