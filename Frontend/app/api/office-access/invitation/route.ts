import { NextResponse } from "next/server";
import { z } from "zod";
import { OfficeAccessError } from "@/lib/office/access-admin";
import { reissueOfficeInvitation, revokeOfficeInvitation } from "@/lib/office/access-recovery";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const schema = z.object({
  invitation_id: z.string().uuid(),
  action: z.enum(["REVOKE", "REISSUE"]).default("REVOKE"),
  reason: z.string().trim().max(500).optional(),
});
export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin Office access change is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid invitation-revocation request" }, { status: 400 });
  try {
    if (parsed.data.action === "REISSUE") {
      const result = await reissueOfficeInvitation({ invitationId: parsed.data.invitation_id });
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    if (!parsed.data.reason || parsed.data.reason.length < 3) {
      return NextResponse.json({ detail: "A reason is required to revoke an invitation" }, { status: 400 });
    }
    return NextResponse.json(
      await revokeOfficeInvitation({ invitationId: parsed.data.invitation_id, reason: parsed.data.reason }),
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  catch (error) { if (error instanceof OfficeAccessError) return NextResponse.json({ detail: error.message }, { status: error.status }); return NextResponse.json({ detail: "Invitation revocation failed" }, { status: 500 }); }
}
