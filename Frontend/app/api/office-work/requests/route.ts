import { NextResponse } from "next/server";
import { z } from "zod";
import { createOfficeRequest, OfficeWorkflowError } from "@/lib/office/workflow-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.object({
  request_type: z.string().trim().min(2).max(80),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(3).max(4000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  target_user_id: z.string().uuid().optional(),
  resource_type: z.string().trim().max(80).optional(),
  resource_key: z.string().trim().max(240).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Office request is not allowed" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid request payload" }, { status: 400 });

  try {
    const result = await createOfficeRequest({
      requestType: parsed.data.request_type,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      targetUserId: parsed.data.target_user_id,
      resourceType: parsed.data.resource_type,
      resourceKey: parsed.data.resource_key,
      payload: parsed.data.payload,
    });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeWorkflowError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to create request";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
