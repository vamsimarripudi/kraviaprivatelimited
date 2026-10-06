import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeSessionContext, officeIdentityIsProvisioned, verifyOfficeMfa } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const requestSchema = z.object({ action: z.literal("verify"), code: z.string().regex(/^\d{6}$/) });

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
    const upgraded = await verifyOfficeMfa(context, parsed.data.code);
    if (upgraded.kind === "pending") {
      return NextResponse.json(
        {
          verified: false,
          device_approval_pending: true,
          expires_at: upgraded.approval.expiresAt,
          device_label: upgraded.approval.deviceLabel,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { verified: true, aal: upgraded.context.identity.aal },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "MFA operation failed";
    return NextResponse.json({ detail }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
