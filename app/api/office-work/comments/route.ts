import { NextResponse } from "next/server";
import { z } from "zod";
import { addRequestComment, listRequestComments, OfficeCollaborationError } from "@/lib/office/collaboration-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const querySchema = z.string().uuid();
const commentSchema = z.object({ request_id: z.string().uuid(), body: z.string().trim().min(1).max(4000) });

export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get("request_id");
  const parsed = querySchema.safeParse(requestId);
  if (!parsed.success) return NextResponse.json({ detail: "Valid request_id is required" }, { status: 400 });
  try {
    return NextResponse.json(await listRequestComments(parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeCollaborationError ? error.status : 500;
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unable to read collaboration" }, { status });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin collaboration mutation is not allowed" }, { status: 403 });
  const parsed = commentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid collaboration comment" }, { status: 400 });
  try {
    return NextResponse.json(await addRequestComment(parsed.data.request_id, parsed.data.body), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeCollaborationError ? error.status : 500;
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unable to add collaboration comment" }, { status });
  }
}
