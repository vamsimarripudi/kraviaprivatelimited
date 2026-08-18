import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { contentPath } from "@/lib/content/seo";
import type { PublicContentType } from "@/lib/content/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Called by the existing authenticated scheduler. It publishes only pre-approved, due records. */
export async function POST(request: Request) {
  const secret = process.env.CORPORATE_AUTOMATION_CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Content scheduler is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Content storage is not configured." }, { status: 503 });
  const now = new Date().toISOString();
  try {
    const { data: scheduled, error } = await admin.from("content_records").select("id,content_type,slug").eq("status", "SCHEDULED").lte("scheduled_for", now).limit(25);
    if (error) return NextResponse.json({ error: "Scheduled content could not be read." }, { status: 500 });
    for (const record of scheduled ?? []) {
      const { data: published } = await admin.from("content_records").update({ status: "PUBLISHED", visibility: "PUBLIC", published_at: now, scheduled_for: null }).eq("id", record.id).eq("status", "SCHEDULED").select("id").maybeSingle();
      if (!published) continue;
      await admin.from("content_publication_events").insert({ content_id: record.id, event_type: "PUBLISHED", reason: "Scheduled publication" });
      await admin.from("corporate_events").upsert({ event_type: "content.published", entity_type: "content_record", entity_id: record.id, idempotency_key: `content.published:${record.id}:scheduled`, payload: { source: "scheduler" } }, { onConflict: "idempotency_key", ignoreDuplicates: true });
      revalidatePath("/"); revalidatePath("/newsroom"); revalidatePath("/sitemap.xml"); revalidatePath(contentPath({ type: record.content_type as PublicContentType, slug: record.slug }));
    }
    return NextResponse.json({ published: scheduled?.length ?? 0 });
  } catch { return NextResponse.json({ error: "Scheduled publication failed. Review the automation failure queue." }, { status: 500 }); }
}
