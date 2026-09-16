import { redirect } from "next/navigation";
import { Activity, FileDown, LogIn, MapPin } from "lucide-react";
import { CorporateActivityBeacon } from "@/components/corporate-activity-beacon";
import { CorporateAccessError, requireCorporateCapability } from "@/lib/corporate/authorization";
import { createClient } from "@/lib/supabase/server";

type AccessEvent = { id: number; event_type: "SIGNED_IN" | "PAGE_VIEWED"; path: string | null; created_at: string; profiles: { full_name: string | null; role: string }[] };
type DownloadEvent = { id: number; created_at: string; document_id: string; profiles: { full_name: string | null; role: string }[] };

export const dynamic = "force-dynamic";
export default async function CorporateAuditPage() {
  try { await requireCorporateCapability("audit.view"); } catch (error) { if (error instanceof CorporateAccessError && error.code === "UNAUTHENTICATED") redirect("/corporate/login?next=/corporate/audit"); throw error; }
  const supabase = await createClient();
  const [{ data: access }, { data: downloads }] = await Promise.all([
    supabase!.from("corporate_access_events").select("id,event_type,path,created_at,profiles:actor_id(full_name,role)").order("created_at", { ascending: false }).limit(100),
    supabase!.from("document_access_events").select("id,document_id,created_at,profiles:actor_id(full_name,role)").eq("event_type", "DOWNLOADED").order("created_at", { ascending: false }).limit(100),
  ]);
  const events = [
    ...((access ?? []) as AccessEvent[]).map((event) => ({ id: `access-${event.id}`, type: event.event_type, detail: event.event_type === "SIGNED_IN" ? "Signed in to Corporate Office" : `Viewed ${event.path ?? "Corporate Office"}`, createdAt: event.created_at, profile: event.profiles[0] ?? null })),
    ...((downloads ?? []) as DownloadEvent[]).map((event) => ({ id: `download-${event.id}`, type: "DOWNLOADED", detail: `Downloaded protected document ${event.document_id}`, createdAt: event.created_at, profile: event.profiles[0] ?? null })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  return <main className="corporate-workspace"><CorporateActivityBeacon /><section className="audit-explorer"><header><div><p className="eyebrow">ADMINISTRATIVE EVIDENCE</p><h1>Corporate access <em>activity</em></h1><p>Shows authenticated Corporate Office sign-ins, internal page visits and protected document downloads. Public-website visitors are not tracked here.</p></div><Activity aria-hidden="true" /></header>{events.length ? <ol>{events.map((event) => <li key={event.id}><span className="audit-icon">{event.type === "SIGNED_IN" ? <LogIn aria-hidden="true" /> : event.type === "DOWNLOADED" ? <FileDown aria-hidden="true" /> : <MapPin aria-hidden="true" />}</span><div><strong>{event.profile?.full_name || "Corporate user"}</strong><p>{event.detail}</p><small>{event.profile?.role?.replaceAll("_", " ") ?? "ROLE NOT RECORDED"} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(event.createdAt))}</small></div></li>)}</ol> : <div className="audit-empty"><Activity aria-hidden="true" /><p>No authorised access events are available yet. Events start appearing after the activity-ledger migration is applied and users sign in.</p></div>}</section></main>;
}
