import { NextResponse } from "next/server";
import { listOfficeAccessState, OfficeAccessError } from "@/lib/office/access-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await listOfficeAccessState();
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OfficeAccessError) return NextResponse.json({ detail: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ detail: "Unable to load Office access governance" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
