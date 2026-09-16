import { Activity, CheckCircle2, Database, FileWarning, ShieldAlert } from "lucide-react";

export type MonitoringSnapshot = {
  database: "operational" | "configuration_required" | "unavailable";
  durationMs: number | null;
  schemaReady: boolean;
  content: { draft: number; review: number; published: number } | null;
  support: { active: number; urgent: number } | null;
  latestAuditAt: string | null;
};

export function AdminMonitoring({ snapshot }: { snapshot: MonitoringSnapshot }) {
  const databaseLabel = snapshot.database === "operational" ? "Operational" : snapshot.database === "configuration_required" ? "Configuration required" : "Unavailable";
  return <section className="admin-monitoring-grid" aria-label="Operational monitoring">
    <article className={`admin-health-card is-${snapshot.database}`}><header><Database aria-hidden="true" /><span>{databaseLabel}</span></header><h2>Database health</h2><p>{snapshot.database === "operational" ? `Authenticated health probe completed${snapshot.durationMs !== null ? ` in ${snapshot.durationMs} ms` : ""}.` : "No healthy database signal is available. Check configuration and the controlled health endpoint."}</p></article>
    <article className={`admin-health-card ${snapshot.schemaReady ? "is-operational" : "is-configuration_required"}`}><header><ShieldAlert aria-hidden="true" /><span>{snapshot.schemaReady ? "Ready" : "Action required"}</span></header><h2>Site-control schema</h2><p>{snapshot.schemaReady ? "Public form settings are governed by an active RLS-protected table." : "The site-control migration has not been detected. Public routes continue using their approved route defaults."}</p></article>
    <article className="admin-health-card"><header><Activity aria-hidden="true" /><span>Live records</span></header><h2>Publication workload</h2><dl><div><dt>Drafts</dt><dd>{snapshot.content?.draft ?? "Restricted"}</dd></div><div><dt>In review</dt><dd>{snapshot.content?.review ?? "Restricted"}</dd></div><div><dt>Published</dt><dd>{snapshot.content?.published ?? "Restricted"}</dd></div></dl></article>
    <article className="admin-health-card"><header><FileWarning aria-hidden="true" /><span>Case operations</span></header><h2>Request queues</h2><dl><div><dt>Active cases</dt><dd>{snapshot.support?.active ?? "Restricted"}</dd></div><div><dt>Urgent cases</dt><dd>{snapshot.support?.urgent ?? "Restricted"}</dd></div></dl><p>{snapshot.latestAuditAt ? `Latest authorised activity: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(snapshot.latestAuditAt))}.` : "No authorised audit event is available to this role."}</p></article>
    <aside className="admin-monitoring-note"><CheckCircle2 aria-hidden="true" /><p>Monitoring is an operational signal, not a compliance claim. It contains aggregate, authorised metadata only—never support messages, credentials or private corporate records.</p></aside>
  </section>;
}
