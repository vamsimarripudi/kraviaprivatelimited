import { NextResponse } from "next/server";
import { z } from "zod";
import { createOfficeTask, getOfficeTaskInbox, OfficeTaskError } from "@/lib/office/task-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const createSchema = z.object({
  assignee_user_id: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
  description: z.string().max(4000).optional(),
  task_type: z.enum(["GENERAL","REQUEST","COMPLIANCE","INCIDENT","SALES","ENGINEERING","PEOPLE","FINANCE","LEGAL","OPERATIONS","PRODUCT"]).optional(),
  priority: z.enum(["LOW","NORMAL","HIGH","URGENT"]).optional(),
  department: z.string().trim().max(80).optional(),
  source_type: z.string().trim().max(80).optional(),
  source_key: z.string().trim().max(240).optional(),
  source_request_id: z.string().uuid().optional(),
  due_at: z.string().datetime({ offset: true }).optional(),
});

export async function GET() {
  try {
    return NextResponse.json(await getOfficeTaskInbox(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeTaskError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load Company Inbox";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin task creation is not allowed" }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid task payload" }, { status: 400 });
  try {
    const result = await createOfficeTask({
      assigneeUserId: parsed.data.assignee_user_id,
      title: parsed.data.title,
      description: parsed.data.description,
      taskType: parsed.data.task_type,
      priority: parsed.data.priority,
      department: parsed.data.department,
      sourceType: parsed.data.source_type,
      sourceKey: parsed.data.source_key,
      sourceRequestId: parsed.data.source_request_id,
      dueAt: parsed.data.due_at,
    });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeTaskError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to create task";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
