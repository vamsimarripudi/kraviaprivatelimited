"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, BadgeCheck, CircleAlert, Gauge, LoaderCircle, RefreshCw, ShieldCheck, Siren } from "lucide-react";
import styles from "./office-operations-monitoring.module.css";

type OperationsSummary = {
  generated_at: string;
  alerts: { total: number; open: number; high_critical: number };
  event_outbox: { pending: number; waiting_handler: number; oldest_pending_at?: string | null; alert_threshold: number };
  workflows: { total: number; failed: number; alert_threshold: number };
  integrations: { production: number; ready: number; attention: number };
  audit: { events: number; latest_at?: string | null };
  worker: {
    key: string;
    state: "NOT_STARTED" | "STALE" | "HEALTHY";
    interval_seconds: number;
    stale_after_seconds: number;
    last_started_at?: string | null;
    last_succeeded_at?: string | null;
    last_failed_at?: string | null;
    last_error_type?: string | null;
    last_duration_ms?: number | null;
    age_seconds?: number | null;
  };
  slo: {
    availability_target_percent: string;
    latency_p95_target_ms: number;
    telemetry_source?: string | null;
    measurement_status: "NOT_CONNECTED" | "SOURCE_DECLARED";
    measured_availability_percent?: number | null;
    measured_latency_p95_ms?: number | null;
    note: string;
  };
  source: string;
};

type OperationalAlert = {
  id: string;
  alert_key: string;
  category: string;
  severity: string;
  title: string;
  entity_type: string;
  entity_id: string;
  status: string;
  detail: Record<string, unknown>;
  created_at?: string | null;
  resolved_at?: string | null;
};

type Snapshot = { summary: OperationsSummary; alerts: OperationalAlert[] };

async function runtime<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-runtime/" + path, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Operations runtime request failed");
  return body as T;
}

async function fetchSnapshot(): Promise<Snapshot> {
  const [summary, alerts] = await Promise.all([
    runtime<OperationsSummary>("operations/summary"),
    runtime<OperationalAlert[]>("operations/alerts"),
  ]);
  return { summary, alerts };
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export function OfficeOperationsMonitoring({ canEvaluate }: { canEvaluate: boolean }) {
  const [data, setData] = useState<Snapshot>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setData(await fetchSnapshot());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Operations monitoring is unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchSnapshot()
      .then((next) => {
        if (active) setData(next);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Operations monitoring is unavailable");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function evaluate() {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await runtime<{ changes: Array<{ alert_key: string; action: string }> }>("operations/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: "{}",
      });
      setNotice(result.changes.length ? `${result.changes.length} runtime alert state change(s) recorded.` : "Runtime alert evaluation completed with no state changes.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Runtime alert evaluation failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Loading runtime operations</h2><p>Reading backend-owned health and alert evidence.</p></div></section>;
  if (!data) return <section className={styles.state}><CircleAlert /><div><h2>Runtime operations unavailable</h2><p>{error ?? "No runtime operations evidence is available."}</p></div></section>;

  const openAlerts = data.alerts.filter((alert) => !["RESOLVED", "CLOSED"].includes(alert.status.toUpperCase()));

  return <section className={styles.shell}>
    <header className={styles.hero}>
      <div>
        <p>RUNTIME OPERATIONS · ALERTING · SLO READINESS</p>
        <h2>Backend health signals with explicit measurement boundaries.</h2>
        <span>{data.summary.source}</span>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => void refresh()} disabled={loading || busy}><RefreshCw />Refresh</button>
        {canEvaluate ? <button type="button" onClick={() => void evaluate()} disabled={busy}><Activity />Evaluate alerts</button> : null}
      </div>
    </header>

    {notice ? <div className={styles.notice}><BadgeCheck />{notice}</div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}

    <div className={styles.metrics}>
      <article><Siren /><div><span>Open runtime alerts</span><b>{data.summary.alerts.open}</b><small>{data.summary.alerts.high_critical} high / critical</small></div></article>
      <article><Activity /><div><span>Domain-event queue</span><b>{data.summary.event_outbox.pending}</b><small>{data.summary.event_outbox.waiting_handler} waiting for handler · threshold {data.summary.event_outbox.alert_threshold}</small></div></article>
      <article><CircleAlert /><div><span>Failed workflows</span><b>{data.summary.workflows.failed}</b><small>Alert threshold {data.summary.workflows.alert_threshold}</small></div></article>
      <article><ShieldCheck /><div><span>Production integrations</span><b>{data.summary.integrations.ready}/{data.summary.integrations.production}</b><small>{data.summary.integrations.attention} need attention</small></div></article>
      <article><Gauge /><div><span>Audit events</span><b>{data.summary.audit.events}</b><small>Latest {dateTime(data.summary.audit.latest_at)}</small></div></article>
      <article data-state={data.summary.worker.state}><Activity /><div><span>Background worker</span><b>{data.summary.worker.state.replace("_", " ")}</b><small>{data.summary.worker.last_succeeded_at ? `Last success ${dateTime(data.summary.worker.last_succeeded_at)}` : "No successful tick recorded"}</small></div></article>
    </div>

    <section className={styles.slo}>
      <div>
        <p>SLO POLICY / TELEMETRY</p>
        <h3>{data.summary.slo.measurement_status === "NOT_CONNECTED" ? "External telemetry not connected" : "Telemetry source declared"}</h3>
        <span>{data.summary.slo.note}</span>
      </div>
      <dl>
        <div><dt>Availability target</dt><dd>{data.summary.slo.availability_target_percent}%</dd></div>
        <div><dt>Latency p95 target</dt><dd>{data.summary.slo.latency_p95_target_ms} ms</dd></div>
        <div><dt>Telemetry source</dt><dd>{data.summary.slo.telemetry_source || "Not connected"}</dd></div>
        <div><dt>Measured availability</dt><dd>{data.summary.slo.measured_availability_percent ?? "Not measured"}</dd></div>
        <div><dt>Measured latency p95</dt><dd>{data.summary.slo.measured_latency_p95_ms ?? "Not measured"}</dd></div>
      </dl>
    </section>

    <section className={styles.alerts}>
      <header><div><p>BACKEND ALERT REGISTER</p><h3>Current runtime exceptions</h3></div><span>Alerts are generated from backend-owned records and automatically resolve when the evaluated condition clears.</span></header>
      <div className={styles.alertGrid}>
        {openAlerts.map((alert) => <article key={alert.id} data-severity={alert.severity}>
          <header><div><small>{alert.category} · {alert.alert_key}</small><h4>{alert.title}</h4></div><em>{alert.severity}</em></header>
          <p>{alert.entity_type} · {alert.entity_id}</p>
          <span>Opened {dateTime(alert.created_at)}</span>
        </article>)}
        {!openAlerts.length ? <div className={styles.empty}>No open backend runtime alerts.</div> : null}
      </div>
    </section>
  </section>;
}
