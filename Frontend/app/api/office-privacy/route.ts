import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { createOfficePrivacyCase, getOfficePrivacyOverview, OfficePrivacyError, transitionOfficePrivacyCase } from "@/lib/office/privacy-server";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_CASE"),
    owner_user_id: z.string().uuid(),
    case_type: z.enum(["ACCESS", "CORRECTION", "ERASURE", "CONSENT_WITHDRAWAL", "GRIEVANCE", "OTHER"]),
    subject_type: z.enum(["CUSTOMER", "EMPLOYEE", "PROSPECT", "VENDOR", "OTHER"]),
    subject_reference: z.string().trim().min(2).max(240),
    jurisdiction: z.string().trim().min(2).max(24).optional(),
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().min(3).max(8000),
    source_channel: optionalText(80),
    source_reference: optionalText(500),
    deadline_at: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({
    action: z.literal("TRANSITION_CASE"),
    case_id: z.string().uuid(),
    status: z.enum(["OPEN", "VERIFY_IDENTITY", "IN_REVIEW", "ACTION_REQUIRED", "COMPLETED", "REJECTED"]),
    note: optionalText(4000),
  }),
]);

export async function GET() {
  try { return NextResponse.json(await getOfficePrivacyOverview(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    const status = error instanceof OfficePrivacyError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load privacy governance";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin privacy mutation is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid privacy request" }, { status: 400 });
  try {
    const result = parsed.data.action === "CREATE_CASE"
      ? await createOfficePrivacyCase({
          ownerUserId: parsed.data.owner_user_id,
          caseType: parsed.data.case_type,
          subjectType: parsed.data.subject_type,
          subjectReference: parsed.data.subject_reference,
          jurisdiction: parsed.data.jurisdiction,
          title: parsed.data.title,
          description: parsed.data.description,
          sourceChannel: parsed.data.source_channel,
          sourceReference: parsed.data.source_reference,
          deadlineAt: parsed.data.deadline_at,
        })
      : await transitionOfficePrivacyCase({ caseId: parsed.data.case_id, status: parsed.data.status, note: parsed.data.note });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficePrivacyError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to update privacy governance";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
