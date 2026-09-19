import { NextResponse } from "next/server";
import { z } from "zod";
import { enrollOfficeMfa, getOfficeSessionContext, officeIdentityIsProvisioned, verifyOfficeMfa } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll") }),
  z.object({ action: z.literal("verify"), code: z.string().regex(/^\d{6}$/) }),
]);

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Office MFA request is not allowed" }, { status: 403 });
  }
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) {
    return NextResponse.json({ detail: "Office sign-in required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid MFA request" }, { status: 400 });

  try {
    if (parsed.data.action === "enroll") {
      return NextResponse.json(await enrollOfficeMfa(context), { headers: { "Cache-Control": "no-store" } });
    }
    const upgraded = await verifyOfficeMfa(context, parsed.data.code);
    return NextResponse.json(
      { verified: true, aal: upgraded.identity.aal },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "MFA operation failed";
    return NextResponse.json({ detail }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
