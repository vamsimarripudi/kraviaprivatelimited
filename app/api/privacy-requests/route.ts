import { NextResponse } from "next/server";
import { submitSupportIntake } from "@/lib/corporate/support-intake";

// Backwards-compatible private-request endpoint. Legacy form payloads are mapped into the restricted Trust & DPDP queue.
export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const values = input as Record<string, unknown>;
  const requestType = typeof values.requestType === "string" ? values.requestType : typeof values.category === "string" ? values.category : "Privacy question";
  const security = requestType === "Security concern";
  return submitSupportIntake(request, {
    ...values,
    requestType,
    subject: typeof values.subject === "string" ? values.subject : requestType,
    description: typeof values.description === "string" ? values.description : values.message,
  }, {
    category: requestType,
    queue: security ? "SECURITY_REPORTING" : "TRUST_DPDPA",
    requestKind: security ? "SECURITY_CONCERN" : "TRUST_DPDPA_REQUEST",
    source: security ? "SECURITY_REPORTING" : "DPDP_PORTAL",
    rateLimit: 4,
  });
}