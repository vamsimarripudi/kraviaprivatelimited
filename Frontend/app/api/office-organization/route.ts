import { NextResponse } from "next/server";
import { getOfficeOrganization, OfficeOrganizationError } from "@/lib/office/organization-server";

export async function GET() {
  try {
    return NextResponse.json(await getOfficeOrganization(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeOrganizationError ? error.status : 500;
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unable to read organization" }, { status });
  }
}
