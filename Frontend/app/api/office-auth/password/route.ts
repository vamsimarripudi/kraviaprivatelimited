import { NextResponse } from "next/server";
import { z } from "zod";
import { changeOfficePassword, getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.object({
  current_password: z.string().min(1).max(256),
  new_password: z.string().min(12).max(256),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin password change is not allowed" }, { status: 403 });
  }
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity) || context.identity.aal !== "aal2") {
    return NextResponse.json({ detail: "AAL2 Office session required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid password change request" }, { status: 400 });

  try {
    const result = await changeOfficePassword(context, parsed.data.current_password, parsed.data.new_password);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Password change failed";
    return NextResponse.json({ detail }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
