"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import styles from "./office-readiness.module.css";

type Gate = { key: string; area: string; state: "READY" | "ATTENTION" | "BLOCKED"; title: string; detail: string; evidence: Array<{ label: string; value: number | string }> };
type Payload = { generated_at: string; summary: { gates: number; blocked: number; attention: number; ready: number }; gates: Gate[]; disclaimer: string };

async function load(): Promise<Payload> {
  const response = await fetch("/api/office-readiness", { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Readiness unavailable");
  return body as Payload;
}
function dateTime(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(d); }

export function OfficeReadiness() {
  const [data, setData] = useState<Payload>();
  const [error, setError] = useState<string>();
  useEffect(() => { let alive = true; void load().then((next) => { if (alive) setData(next); }).catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Readiness unavailable"); }); return () => { alive = false; }; }, []);
  if (error) return <section className={styles.state}><CircleAlert /><div><h2>Readiness unavailable</h2><p>{error}</p></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Building readiness evidence</h2><p>Reading canonical controls without inventing a score.</p></div></section>;

  return <section className={styles.shell}>
    <header className={styles.hero}><div><p>PRODUCTION & COMPANY READINESS</p><h2>Evidence gates, not a fabricated health score.</h2><span>{data.disclaimer}</span></div><small>Generated {dateTime(data.generated_at)}</small></header>
    <div className={styles.metrics}><article data-state="BLOCKED"><ShieldAlert /><b>{data.summary.blocked}</b><span>blocked gates</span></article><article data-state="ATTENTION"><CircleAlert /><b>{data.summary.attention}</b><span>need attention</span></article><article data-state="READY"><CircleCheck /><b>{data.summary.ready}</b><span>ready evidence gates</span></article><article><ShieldCheck /><b>{data.summary.gates}</b><span>evaluated gates</span></article></div>
    <div className={styles.gates}>{data.gates.map((gate) => <article key={gate.key} data-state={gate.state}><header><div><p>{gate.area}</p><h3>{gate.title}</h3></div><span>{gate.state === "READY" ? <CircleCheck /> : gate.state === "BLOCKED" ? <ShieldAlert /> : <CircleAlert />}{gate.state}</span></header><p>{gate.detail}</p><div className={styles.evidence}>{gate.evidence.map((item) => <div key={item.label}><span>{item.label}</span><b>{item.value}</b></div>)}</div></article>)}</div>
  </section>;
}
