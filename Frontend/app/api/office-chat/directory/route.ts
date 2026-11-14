import { NextResponse } from "next/server";
import { listOfficeChatDirectory, OfficeChatError } from "@/lib/office/chat-server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return NextResponse.json(await listOfficeChatDirectory(q), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof OfficeChatError ? error.message : "Directory unavailable" },
      { status: error instanceof OfficeChatError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
  }
}
