import { NextResponse } from "next/server";
import { getOfficeChatUnreadSummary, OfficeChatError } from "@/lib/office/chat-server";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await getOfficeChatUnreadSummary(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({
      detail: error instanceof OfficeChatError ? error.message : "Unread state unavailable",
    }, {
      status: error instanceof OfficeChatError ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
