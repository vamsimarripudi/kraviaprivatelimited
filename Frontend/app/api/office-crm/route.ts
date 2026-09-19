import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addOfficeCrmActivity,
  createOfficeCrmLead,
  createOfficeCrmOpportunity,
  getOfficeCrmOverview,
  OfficeCrmError,
  setOfficeCrmLeadStage,
  setOfficeCrmOpportunityStage,
} from "@/lib/office/crm-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const createSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_LEAD"),
    owner_user_id: z.string().uuid(),
    account_name: z.string().trim().min(2).max(180),
    contact_name: optionalText(180),
    contact_email: z.string().trim().email().max(254).optional().or(z.literal("")),
    contact_phone: optionalText(40),
    source: optionalText(80),
    value_minor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    currency: z.string().trim().length(3).optional(),
    country: optionalText(80),
    notes: optionalText(4000),
  }),
  z.object({
    action: z.literal("CREATE_OPPORTUNITY"),
    owner_user_id: z.string().uuid(),
    lead_id: z.string().uuid().optional(),
    customer_id: optionalText(120),
    product_id: optionalText(120),
    title: z.string().trim().min(3).max(180),
    value_minor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    currency: z.string().trim().length(3).optional(),
    expected_close_date: z.string().date().optional(),
    next_step: optionalText(1000),
  }),
  z.object({ action: z.literal("ADD_ACTIVITY"), lead_id: z.string().uuid().optional(), opportunity_id: z.string().uuid().optional(), activity_type: z.enum(["NOTE","CALL","EMAIL","MEETING","DEMO","PROPOSAL","FOLLOW_UP"]), subject: z.string().trim().min(2).max(180), body: optionalText(4000), occurred_at: z.string().datetime({ offset: true }).optional() }),
]);

const stageSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SET_LEAD_STAGE"),
    lead_id: z.string().uuid(),
    stage: z.enum(["NEW","QUALIFIED","DISQUALIFIED","CONVERTED"]),
    customer_id: optionalText(120),
  }),
  z.object({
    action: z.literal("SET_OPPORTUNITY_STAGE"),
    opportunity_id: z.string().uuid(),
    stage: z.enum(["QUALIFICATION","DISCOVERY","DEMO","PROPOSAL","NEGOTIATION","CONTRACTING","WON","LOST"]),
    next_step: optionalText(1000),
    lost_reason: optionalText(1000),
  }),
]);

export async function GET() {
  try {
    return NextResponse.json(await getOfficeCrmOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeCrmError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load CRM";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin CRM mutation is not allowed" }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid CRM request" }, { status: 400 });
  try {
    let result: Record<string, unknown>;
    switch (parsed.data.action) {
      case "CREATE_LEAD":
        result = await createOfficeCrmLead({
          ownerUserId: parsed.data.owner_user_id,
          accountName: parsed.data.account_name,
          contactName: parsed.data.contact_name,
          contactEmail: parsed.data.contact_email || undefined,
          contactPhone: parsed.data.contact_phone,
          source: parsed.data.source,
          valueMinor: parsed.data.value_minor,
          currency: parsed.data.currency,
          country: parsed.data.country,
          notes: parsed.data.notes,
        });
        break;
      case "CREATE_OPPORTUNITY":
        result = await createOfficeCrmOpportunity({
          ownerUserId: parsed.data.owner_user_id,
          leadId: parsed.data.lead_id,
          customerId: parsed.data.customer_id || undefined,
          productId: parsed.data.product_id || undefined,
          title: parsed.data.title,
          valueMinor: parsed.data.value_minor,
          currency: parsed.data.currency,
          expectedCloseDate: parsed.data.expected_close_date,
          nextStep: parsed.data.next_step,
        });
        break;
      case "ADD_ACTIVITY":
        if (!parsed.data.lead_id && !parsed.data.opportunity_id) return NextResponse.json({ detail: "Lead or opportunity is required" }, { status: 400 });
        result = await addOfficeCrmActivity({ leadId: parsed.data.lead_id, opportunityId: parsed.data.opportunity_id, activityType: parsed.data.activity_type, subject: parsed.data.subject, body: parsed.data.body, occurredAt: parsed.data.occurred_at });
        break;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeCrmError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to update CRM";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}


export async function PATCH(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin CRM mutation is not allowed" }, { status: 403 });
  }
  const parsed = stageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid CRM stage update" }, { status: 400 });

  try {
    const result = parsed.data.action === "SET_LEAD_STAGE"
      ? await setOfficeCrmLeadStage({
          leadId: parsed.data.lead_id,
          stage: parsed.data.stage,
          customerId: parsed.data.customer_id || undefined,
        })
      : await setOfficeCrmOpportunityStage({
          opportunityId: parsed.data.opportunity_id,
          stage: parsed.data.stage,
          nextStep: parsed.data.next_step,
          lostReason: parsed.data.lost_reason,
        });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeCrmError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to update CRM stage";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
