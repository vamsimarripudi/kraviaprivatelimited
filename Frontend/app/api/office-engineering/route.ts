import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createOfficeEngineeringIncident,
  getOfficeEngineeringControlCenter,
  OfficeEngineeringError,
  registerOfficeEngineeringService,
  transitionOfficeEngineeringIncident,
} from "@/lib/office/engineering-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("REGISTER_SERVICE"),
    product_id: optionalText(120),
    name: z.string().trim().min(2).max(160),
    project_key: z.string().trim().min(2).max(120),
    repository_key: optionalText(240),
    repository_provider: optionalText(80),
    runtime_provider: optionalText(80),
    runtime_service_key: optionalText(240),
    environment: z.enum(["DEVELOPMENT", "PREVIEW", "STAGING", "PRODUCTION"]),
    public_url: z.string().trim().url().max(600).optional().or(z.literal("")),
    owner_team: optionalText(120),
  }),
  z.object({
    action: z.literal("CREATE_INCIDENT"),
    service_id: z.string().uuid(),
    severity: z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]),
    title: z.string().trim().min(3).max(180),
    summary: optionalText(6000),
    owner_user_id: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("TRANSITION_INCIDENT"),
    incident_id: z.string().uuid(),
    transition: z.enum(["MITIGATE", "MONITOR", "RESOLVE", "REOPEN"]),
    note: optionalText(2000),
  }),
]);

export async function GET() {
  try {
    return NextResponse.json(await getOfficeEngineeringControlCenter(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeEngineeringError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load engineering control center";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin engineering mutation is not allowed" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid engineering request" }, { status: 400 });
  try {
    let result: Record<string, unknown>;
    switch (parsed.data.action) {
      case "REGISTER_SERVICE":
        result = await registerOfficeEngineeringService({
          productId: parsed.data.product_id || undefined,
          name: parsed.data.name,
          projectKey: parsed.data.project_key,
          repositoryKey: parsed.data.repository_key,
          repositoryProvider: parsed.data.repository_provider,
          runtimeProvider: parsed.data.runtime_provider,
          runtimeServiceKey: parsed.data.runtime_service_key,
          environment: parsed.data.environment,
          publicUrl: parsed.data.public_url || undefined,
          ownerTeam: parsed.data.owner_team,
        });
        break;
      case "CREATE_INCIDENT":
        result = await createOfficeEngineeringIncident({
          serviceId: parsed.data.service_id,
          severity: parsed.data.severity,
          title: parsed.data.title,
          summary: parsed.data.summary,
          ownerUserId: parsed.data.owner_user_id,
        });
        break;
      case "TRANSITION_INCIDENT":
        result = await transitionOfficeEngineeringIncident({
          incidentId: parsed.data.incident_id,
          action: parsed.data.transition,
          note: parsed.data.note,
        });
        break;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeEngineeringError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to update engineering control center";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
