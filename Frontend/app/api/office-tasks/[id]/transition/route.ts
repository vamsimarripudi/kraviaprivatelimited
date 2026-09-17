import { NextResponse } from "next/server";
import { z } from "zod";
import { OfficeTaskError, transitionOfficeTask } from "@/lib/office/task-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.object({
  action: z.enum(["START","BLOCK","COMPLETE","REOPEN","CANCEL"]),
  note: z.string().trim().max(2000).optional(),
});

type Props = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Props) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin task mutation is not allowed" }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ detail: "Invalid task id" }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid task transition" }, { status: 400 });
  try {
    const result = await transitionOfficeTask({ taskId: id, action: parsed.data.action, note: parsed.data.note });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeTaskError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to update task";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
