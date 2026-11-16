import { NextResponse } from "next/server";
import { OfficePermissionError } from "@/lib/office/permission-engine";
import { getOfficeHrReadiness, HrReadinessError } from "@/lib/office/hr-readiness-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" } as const;

// Aggregate-only GET. No mutation, salary details, employee names or banking data.
export async function GET() {
  try {
    return NextResponse.json(await getOfficeHrReadiness(), { headers });
  } catch (error) {
    const status = error instanceof OfficePermissionError || error instanceof HrReadinessError
      ? error.status : 500;
    return NextResponse.json({
      detail: error instanceof OfficePermissionError || error instanceof HrReadinessError
        ? error.message : "HR readiness evidence is temporarily unavailable",
    }, { status, headers });
  }
}
