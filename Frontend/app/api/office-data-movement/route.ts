import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { createOfficeDataMovementRequest, getOfficeDataMovement, OfficeDataMovementError } from "@/lib/office/data-movement-server";

const schema = z.object({
  kind: z.enum(["EXPORT", "IMPORT"]),
  scope_type: z.enum(["COMPANY", "DEPARTMENT", "TEAM", "PRODUCT", "PROJECT", "REPOSITORY", "COST_CENTER", "OWN"]),
  scope_key: z.string().trim().max(240).optional(),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(3).max(4000),
  purpose: z.string().trim().min(3).max(1000),
  classification: z.enum(["INTERNAL", "CONFIDENTIAL", "RESTRICTED"]),
  format: z.enum(["CSV", "JSON", "PDF", "OTHER"]).optional(),
  source_reference: z.string().trim().max(500).optional(),
});

export async function GET() {
  try { return NextResponse.json(await getOfficeDataMovement(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    const status = error instanceof OfficeDataMovementError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load data movement";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin data movement mutation is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid data movement request" }, { status: 400 });
  try {
    const result = await createOfficeDataMovementRequest({
      kind: parsed.data.kind,
      scopeType: parsed.data.scope_type,
      scopeKey: parsed.data.scope_key,
      title: parsed.data.title,
      description: parsed.data.description,
      purpose: parsed.data.purpose,
      classification: parsed.data.classification,
      format: parsed.data.format,
      sourceReference: parsed.data.source_reference,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeDataMovementError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to create data movement request";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
