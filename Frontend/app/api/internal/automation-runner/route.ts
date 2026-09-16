import { NextResponse } from "next/server";
import { runAutomationBatch } from "@/lib/corporate/automation-runner";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CORPORATE_AUTOMATION_CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Automation scheduler is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Automation storage is not configured." }, { status: 503 });
  try { const outcomes = await runAutomationBatch(admin); return NextResponse.json({ processed: outcomes.length, outcomes }); }
  catch { return NextResponse.json({ error: "Automation processing failed. Review the internal failure queue." }, { status: 500 }); }
}
