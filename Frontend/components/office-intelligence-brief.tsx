"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, BrainCircuit, CircleAlert, CircleCheck, LoaderCircle, ShieldAlert, Sparkles } from "lucide-react";
import styles from "./office-intelligence-brief.module.css";

type Attention = { key: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO"; area: string; title: string; detail: string; href: string };
type Brief = {
  generated_at: string;
  mode: string;
  disclaimer: string;
  metrics: {
    active_tasks: number;
    overdue_tasks: number;
    blocked_tasks: number;
    pending_approval_steps: number;
    active_incidents: number;
    critical_incidents: number;
    open_opportunities: number;
    pipeline_value_minor: number;
    receivables_minor: number;
    invoices_with_balance: number;
    compliance_due_30d: number;
    unread_notifications: number;
    active_auth_sessions: number;
    high_risk_auth_sessions: number;
  };
  attention: Attention[];
};

async function load(): Promise<Brief> {
  const response = await fetch("/api/office-intelligence", { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Unable to build company brief");
  return body as Brief;
}

function money(minor: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minor / 100);
}

function icon(severity: Attention["severity"]) {
  if (severity === "CRITICAL") return <ShieldAlert />;
  if (severity === "HIGH") return <CircleAlert />;
  if (severity === "MEDIUM") return <AlertTriangle />;
  return <CircleCheck />;
}

export function OfficeIntelligenceBrief({ compact = false }: { compact?: boolean }) {
  const [brief, setBrief] = useState<Brief>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    void load().then((next) => { if (alive) setBrief(next); }).catch((caught: unknown) => {
      if (alive) setError(caught instanceof Error ? caught.message : "Unable to build company brief");
    });
    return () => { alive = false; };
  }, []);

  if (error) return <section className={styles.state}><AlertTriangle /><div><h2>Company intelligence unavailable</h2><p>{error}</p></div></section>;
  if (!brief) return <section className={styles.state}><LoaderCircle className="spin" /><div><h2>Building company brief</h2><p>Reading current Office records without inferring missing facts.</p></div></section>;

  const visibleAttention = compact ? brief.attention.slice(0, 4) : brief.attention;
  return <section className={styles.shell} data-compact={compact}>
    <header className={styles.hero}><div className={styles.mark}><BrainCircuit /></div><div><p>KRAVIA INTELLIGENCE</p><h2>{compact ? "What needs executive attention now." : "A read-first company brief from canonical records."}</h2><span>{brief.disclaimer}</span></div><div className={styles.mode}><Sparkles /><span>Deterministic V1</span><small>No autonomous writes</small></div></header>

    <div className={styles.metrics}><article><span>Pending approvals</span><strong>{brief.metrics.pending_approval_steps}</strong><small>{brief.metrics.overdue_tasks} overdue tasks</small></article><article><span>Incidents</span><strong>{brief.metrics.active_incidents}</strong><small>{brief.metrics.critical_incidents} SEV1/SEV2</small></article><article><span>Open pipeline</span><strong>{brief.metrics.open_opportunities}</strong><small>{money(brief.metrics.pipeline_value_minor)} visible value</small></article><article><span>Receivables</span><strong>{money(brief.metrics.receivables_minor)}</strong><small>{brief.metrics.invoices_with_balance} invoices with balance</small></article><article><span>Compliance due</span><strong>{brief.metrics.compliance_due_30d}</strong><small>Next 30 days / overdue</small></article><article><span>Security sessions</span><strong>{brief.metrics.active_auth_sessions}</strong><small>{brief.metrics.high_risk_auth_sessions} high risk</small></article></div>

    <div className={styles.attention}>{visibleAttention.map((item) => <Link href={item.href} className={styles.item} key={item.key} data-severity={item.severity}><div className={styles.icon}>{icon(item.severity)}</div><div><span>{item.area} · {item.severity}</span><b>{item.title}</b><p>{item.detail}</p></div><ArrowRight /></Link>)}</div>
    {compact && brief.attention.length > visibleAttention.length ? <Link className={styles.open} href="/office/intelligence">Open full intelligence brief →</Link> : null}
  </section>;
}
