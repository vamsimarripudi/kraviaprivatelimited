import { NextResponse } from "next/server";
import { getOfficeWorkOverview, OfficeWorkflowError } from "@/lib/office/workflow-server";

export async function GET() {
  try {
    const data = await getOfficeWorkOverview();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeWorkflowError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load Office work";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
