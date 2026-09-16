import { NextResponse } from "next/server";
import { z } from "zod";
import { decideOfficeRequest, OfficeWorkflowError } from "@/lib/office/workflow-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(2000).optional(),
});

type Props = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Props) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Office approval is not allowed" }, { status: 403 });
  }
  const { id } = await params;
  const idCheck = z.string().uuid().safeParse(id);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!idCheck.success || !parsed.success) return NextResponse.json({ detail: "Invalid approval request" }, { status: 400 });

  try {
    const result = await decideOfficeRequest({ requestId: id, decision: parsed.data.decision, note: parsed.data.note });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeWorkflowError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to record approval";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
