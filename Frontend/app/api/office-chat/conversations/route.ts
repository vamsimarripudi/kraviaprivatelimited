import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { listOfficeChatConversations, OfficeChatError, startOfficeChatDm } from "@/lib/office/chat-server";
export const dynamic = "force-dynamic";
const schema = z.object({ recipient_user_id: z.string().uuid() }).strict();
function failure(error: unknown) {
  const status = error instanceof OfficeChatError ? error.status : 500;
  return NextResponse.json({ detail: error instanceof OfficeChatError ? error.message : "Communication unavailable" },
    { status, headers: { "Cache-Control": "no-store" } });
}
export async function GET() {
  try { return NextResponse.json(await listOfficeChatConversations(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin requests are forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid recipient" }, { status: 400 });
  try { return NextResponse.json(await startOfficeChatDm(parsed.data.recipient_user_id),
    { status: 201, headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
