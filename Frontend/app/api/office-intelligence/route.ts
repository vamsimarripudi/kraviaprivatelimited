import { NextResponse } from "next/server";
import { getOfficeIntelligenceBrief, OfficeIntelligenceError } from "@/lib/office/intelligence-server";

export async function GET() {
  try {
    return NextResponse.json(await getOfficeIntelligenceBrief(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeIntelligenceError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to build company intelligence brief";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
