import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import { bindCurrentOfficeDevice, getMyOfficeDevices, unbindCurrentOfficeDevice } from "@/lib/office/device-binding-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const bindSchema = z.object({ device_id: z.string().uuid() });

async function aal2Context() {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity) || context.identity.aal !== "aal2") return null;
  return context;
}

export async function GET() {
  const context = await aal2Context();
  if (!context) return NextResponse.json({ detail: "AAL2 Office session required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    return NextResponse.json({ devices: await getMyOfficeDevices(context.identity.userId) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ detail: "Unable to load registered devices" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin device binding is not allowed" }, { status: 403 });
  const context = await aal2Context();
  if (!context) return NextResponse.json({ detail: "AAL2 Office session required" }, { status: 401 });
  const parsed = bindSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid device binding request" }, { status: 400 });
  try {
    const deviceId = await bindCurrentOfficeDevice(request, context.identity.userId, parsed.data.device_id, "aal2", context.session.access_token);
    return NextResponse.json({ bound: true, device_id: deviceId, devices: await getMyOfficeDevices(context.identity.userId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to bind device";
    return NextResponse.json({ detail }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin device unbinding is not allowed" }, { status: 403 });
  const context = await aal2Context();
  if (!context) return NextResponse.json({ detail: "AAL2 Office session required" }, { status: 401 });
  try {
    await unbindCurrentOfficeDevice(request, context.identity.userId, context.session.access_token);
    return NextResponse.json({ bound: false, devices: await getMyOfficeDevices(context.identity.userId) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ detail: "Unable to unbind device" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
