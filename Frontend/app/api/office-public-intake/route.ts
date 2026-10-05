import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  addOfficePublicIntakeFollowUp,
  claimOfficePublicIntake,
  getOfficePublicIntakeOverview,
  OfficePublicIntakeError,
  publicIntakeQueues,
  publicIntakeRecordKinds,
  publicIntakeStatuses,
  transitionOfficePublicIntake,
} from "@/lib/office/public-intake-server";

const queue = z.enum(publicIntakeQueues);
const recordKind = z.enum(publicIntakeRecordKinds);
const base = z.object({ queue, record_kind: recordKind, id: z.string().uuid(), version: z.number().int().positive() });
const schema = z.discriminatedUnion("action", [
  base.extend({ action: z.literal("CLAIM") }),
  base.extend({ action: z.literal("TRANSITION"), status: z.enum(publicIntakeStatuses as [string, ...string[]]) }),
  base.extend({ action: z.literal("FOLLOW_UP"), body: z.string().trim().min(1).max(5000) }),
]);

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof OfficePublicIntakeError ? error.status : 500;
  const detail = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("queue");
  const parsed = queue.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ detail: "Invalid public intake queue" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try { return NextResponse.json(await getOfficePublicIntakeOverview(parsed.data), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error, "Unable to load public intake requests"); }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin public intake mutation is not allowed" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid public intake action" }, { status: 400 });
  try {
    const result = parsed.data.action === "CLAIM"
      ? await claimOfficePublicIntake({ queue: parsed.data.queue, recordKind: parsed.data.record_kind, id: parsed.data.id, version: parsed.data.version })
      : parsed.data.action === "TRANSITION"
        ? await transitionOfficePublicIntake({ queue: parsed.data.queue, recordKind: parsed.data.record_kind, id: parsed.data.id, version: parsed.data.version, status: parsed.data.status })
        : await addOfficePublicIntakeFollowUp({ queue: parsed.data.queue, recordKind: parsed.data.record_kind, id: parsed.data.id, version: parsed.data.version, body: parsed.data.body });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error, "Unable to update public intake requests"); }
}
