import { z } from "zod";
import { submitSupportIntake, supportIntakeFields } from "@/lib/corporate/support-intake";

const requestSchema = supportIntakeFields.extend({
  category: z.enum(["Product support", "Account access", "Billing", "Other"]),
});

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "Please review the required support details." }, { status: 400 });
  return submitSupportIntake(request, parsed.data, {
    category: parsed.data.category,
    queue: "GENERAL",
    requestKind: "SUPPORT_REQUEST",
    source: "PUBLIC_SUPPORT",
    rateLimit: 6,
  });
}