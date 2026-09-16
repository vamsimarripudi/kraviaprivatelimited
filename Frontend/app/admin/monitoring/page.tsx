import { AdminPageHeader } from "@/components/admin-console";
import { AdminMonitoring } from "@/components/admin-monitoring";
import { getMonitoringSnapshot } from "@/lib/admin/monitoring";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminMonitoringPage() {
  const snapshot = await getMonitoringSnapshot();
  return <section className="admin-page">
    <AdminPageHeader eyebrow="OPERATIONAL MONITORING" title="Signals for action—not a decorative status board." intro="Database availability, schema readiness and governed workloads are tested from the server at render time. Restricted data never appears in these aggregates." />
    <AdminMonitoring snapshot={snapshot} />
  </section>;
}