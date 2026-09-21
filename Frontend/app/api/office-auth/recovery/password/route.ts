import { NextResponse } from "next/server";
import { z } from "zod";
import { clearOfficeSessionCookies, completeOfficePasswordRecovery } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.object({
  token: z.string().min(64).max(4096),
  new_password: z.string().min(12).max(256),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin recovery request rejected" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid recovery-password request" }, { status: 400 });
  try {
    const result = await completeOfficePasswordRecovery(parsed.data.token, parsed.data.new_password);
    await clearOfficeSessionCookies();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Password recovery failed";
    return NextResponse.json({ detail }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
