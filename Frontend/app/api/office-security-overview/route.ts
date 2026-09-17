import { NextResponse } from "next/server";
import { getOfficeSecurityOverview, OfficeSecurityOverviewError } from "@/lib/office/security-overview-server";

export async function GET() {
  try { return NextResponse.json(await getOfficeSecurityOverview(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    const status = error instanceof OfficeSecurityOverviewError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load security overview";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
