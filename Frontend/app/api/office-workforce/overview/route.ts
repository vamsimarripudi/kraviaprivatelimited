import { NextResponse } from "next/server";
import { getOfficeWorkforceLiveOverview, OfficeWorkforceOverviewError } from "@/lib/office/workforce-overview-server";

export async function GET() {
  try {
    return NextResponse.json(await getOfficeWorkforceLiveOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeWorkforceOverviewError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load workforce overview";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
