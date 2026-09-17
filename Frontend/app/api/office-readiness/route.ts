import { NextResponse } from "next/server";
import { getOfficeReadiness, OfficeReadinessError } from "@/lib/office/readiness-server";

export async function GET() {
  try { return NextResponse.json(await getOfficeReadiness(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    const status = error instanceof OfficeReadinessError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load readiness";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
