import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeEmbedRegistry, OfficeEmbedError, setOfficeEmbedStatus, upsertOfficeEmbed } from "@/lib/office/embed-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("UPSERT"), code: z.string().trim().min(2).max(80), title: z.string().trim().min(2).max(120), description: z.string().trim().max(600).optional(), url: z.string().url(), allowed_host: z.string().trim().min(3).max(253), required_permission: z.string().trim().min(2).max(160), status: z.enum(["ACTIVE", "DISABLED"]).default("ACTIVE") }),
  z.object({ action: z.literal("STATUS"), code: z.string().trim().min(2).max(80), status: z.enum(["ACTIVE", "DISABLED"]) }),
]);

export async function GET() {
  try {
    return NextResponse.json(await getOfficeEmbedRegistry(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeEmbedError ? error.status : 500;
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unable to load embedded workspaces" }, { status });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin embed mutation is not allowed" }, { status: 403 });
  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid embedded-workspace request" }, { status: 400 });
  try {
    const input = parsed.data;
    const result = input.action === "UPSERT"
      ? await upsertOfficeEmbed({ code: input.code, title: input.title, description: input.description, url: input.url, allowedHost: input.allowed_host, requiredPermission: input.required_permission, status: input.status })
      : await setOfficeEmbedStatus(input.code, input.status);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof OfficeEmbedError ? error.status : 500;
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unable to manage embedded workspace" }, { status });
  }
}
