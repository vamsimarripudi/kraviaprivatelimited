import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ service: "supabase", status: "configuration_required" }, { status: 503 });
  const { error } = await supabase.from("profiles").select("id", { head: true }).limit(1);
  if (error) return NextResponse.json({ service: "supabase", status: "unavailable" }, { status: 503 });
  return NextResponse.json({ service: "supabase", status: "ok" });
}
