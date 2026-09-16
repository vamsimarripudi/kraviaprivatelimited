import { z } from "zod";
import { submitSupportIntake, supportIntakeFields } from "@/lib/corporate/support-intake";

const requestSchema = supportIntakeFields.extend({
  requestType: z.enum(["Privacy question", "Access / information request", "Correction", "Erasure", "Consent-related request", "Grievance", "Accessibility feedback", "Security concern", "Other"]),
});

const securityTypes = new Set(["Security concern"]);

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "Please review the required Trust or DPDP request details." }, { status: 400 });
  const security = securityTypes.has(parsed.data.requestType);
  return submitSupportIntake(request, parsed.data, {
    category: parsed.data.requestType,
    queue: security ? "SECURITY_REPORTING" : "TRUST_DPDPA",
    requestKind: security ? "SECURITY_CONCERN" : "TRUST_DPDPA_REQUEST",
    source: security ? "SECURITY_REPORTING" : "DPDP_PORTAL",
    rateLimit: 4,
  });
}