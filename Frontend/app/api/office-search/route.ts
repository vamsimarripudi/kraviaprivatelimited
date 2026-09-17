import { NextRequest, NextResponse } from "next/server";
import { OfficeSearchError, searchOffice } from "@/lib/office/search-server";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    return NextResponse.json(await searchOffice(query), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeSearchError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to search KRAVIA Office";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
