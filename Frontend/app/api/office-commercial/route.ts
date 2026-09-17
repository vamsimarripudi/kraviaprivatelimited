import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createOfficeCommercialStageRequest,
  getOfficeCommercialHandoffs,
  initializeOfficeCommercialHandoff,
  OfficeCommercialError,
} from "@/lib/office/commercial-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("INITIALIZE"), opportunity_id: z.string().uuid() }),
  z.object({ action: z.literal("CREATE_STAGE_REQUEST"), handoff_id: z.string().uuid(), stage: z.enum(["CONTRACT", "SUBSCRIPTION", "INVOICE"]) }),
]);

export async function GET() {
  try {
    return NextResponse.json(await getOfficeCommercialHandoffs(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeCommercialError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load commercial handoff";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin commercial mutation is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid commercial handoff request" }, { status: 400 });
  try {
    const result = parsed.data.action === "INITIALIZE"
      ? await initializeOfficeCommercialHandoff(parsed.data.opportunity_id)
      : await createOfficeCommercialStageRequest(parsed.data.handoff_id, parsed.data.stage);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeCommercialError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to update commercial handoff";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
