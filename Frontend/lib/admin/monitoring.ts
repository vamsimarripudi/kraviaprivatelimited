import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { MonitoringSnapshot } from "@/components/admin-monitoring";
import { requireAnyCorporateCapability } from "@/lib/corporate/authorization";

/** Server-only aggregate monitoring. Authorization is checked before the privileged client is created. */
export async function getMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  await requireAnyCorporateCapability("security.manage", "readiness.view", "automation.view");
  const supabase = createAdminClient();
  if (!supabase) return { database: "configuration_required", durationMs: null, schemaReady: false, content: null, support: null, latestAuditAt: null };
  const start = performance.now();
  const { error: probeError } = await supabase.from("profiles").select("id", { head: true }).limit(1);
  const durationMs = Math.round(performance.now() - start);
  if (probeError) return { database: "unavailable", durationMs, schemaReady: false, content: null, support: null, latestAuditAt: null };
  const [formProbe, contentResult, supportResult, auditResult] = await Promise.all([
    supabase.from("public_form_settings").select("form_key", { head: true }).limit(1),
    supabase.from("content_records").select("status"),
    supabase.from("support_cases").select("status,priority").neq("status", "CLOSED"),
    supabase.from("audit_events").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);
  const contentRows = contentResult.data ?? [];
  const supportRows = supportResult.data ?? [];
  return {
    database: "operational",
    durationMs,
    schemaReady: !formProbe.error,
    content: contentResult.error ? null : { draft: contentRows.filter((row) => row.status === "DRAFT" || row.status === "CHANGES_REQUESTED").length, review: contentRows.filter((row) => row.status === "IN_REVIEW").length, published: contentRows.filter((row) => row.status === "PUBLISHED").length },
    support: supportResult.error ? null : { active: supportRows.length, urgent: supportRows.filter((row) => row.priority === "URGENT").length },
    latestAuditAt: auditResult.data?.[0]?.created_at ?? null,
  };
}
