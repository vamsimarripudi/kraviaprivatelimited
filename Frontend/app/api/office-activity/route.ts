import { NextRequest, NextResponse } from "next/server";
import { getOfficeActivityTimeline } from "@/lib/office/activity-server";

export async function GET(request: NextRequest) {
  const requested = Number(request.nextUrl.searchParams.get("limit") ?? 120);
  try {
    return NextResponse.json(await getOfficeActivityTimeline(requested), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to load Office activity";
    return NextResponse.json({ detail }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
