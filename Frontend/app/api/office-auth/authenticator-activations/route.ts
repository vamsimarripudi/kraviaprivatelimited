import { NextResponse } from "next/server";
import { z } from "zod";
import {
  approveAuthenticatorActivationRequest,
  getOfficeSessionContext,
  listAuthenticatorActivationRequests,
  officeIdentityIsProvisioned,
} from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const approvalSchema = z.object({ activation_id: z.string().uuid() });

async function approvalContext() {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity) || context.identity.aal !== "aal2") return null;
  return context;
}

export async function GET() {
  const context = await approvalContext();
  if (!context) return NextResponse.json({ detail: "AAL2 Office session required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    return NextResponse.json(await listAuthenticatorActivationRequests(context), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to load Authenticator activation requests";
    return NextResponse.json({ detail }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin Authenticator approval is not allowed" }, { status: 403 });
  const context = await approvalContext();
  if (!context) return NextResponse.json({ detail: "AAL2 Office session required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const parsed = approvalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid Authenticator activation approval" }, { status: 400 });
  try {
    return NextResponse.json(await approveAuthenticatorActivationRequest(context, parsed.data.activation_id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to approve Authenticator activation";
    return NextResponse.json({ detail }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
}
