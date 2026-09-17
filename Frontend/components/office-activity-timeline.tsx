"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, LoaderCircle } from "lucide-react";
import styles from "./office-activity-timeline.module.css";

type Item = {
  id: string;
  area: "WORK" | "REQUEST" | "CRM" | "ENGINEERING" | "SECURITY";
  kind: string;
  title: string;
  detail: string;
  occurred_at: string;
  href: string;
};

type Payload = { generated_at: string; disclaimer: string; items: Item[] };

async function load(): Promise<Payload> {
  const response = await fetch("/api/office-activity?limit=160", { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Unable to load Office activity");
  return body as Payload;
}

function when(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Unknown time";
}

export function OfficeActivityTimeline() {
  const [payload, setPayload] = useState<Payload>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    void load().then((next) => { if (alive) setPayload(next); }).catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Unable to load Office activity"); });
    return () => { alive = false; };
  }, []);

  if (error) return <section className={styles.state}><AlertTriangle /><div><h2>Activity timeline unavailable</h2><p>{error}</p></div></section>;
  if (!payload) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Building authorized timeline</h2><p>Reading only records already visible in your current authority.</p></div></section>;

  return <section className={styles.shell}>
    <header><div className={styles.icon}><Activity /></div><div><p>COMPANY ACTIVITY</p><h2>One chronology across visible work.</h2><span>{payload.disclaimer}</span></div></header>
    {payload.items.length ? <div className={styles.timeline}>{payload.items.map((item) => <Link href={item.href} key={item.id} className={styles.item} data-area={item.area}><div className={styles.marker} /><div className={styles.content}><div><span>{item.area} · {item.kind}</span><time>{when(item.occurred_at)}</time></div><b>{item.title}</b>{item.detail ? <p>{item.detail}</p> : null}</div><ArrowRight aria-hidden="true" /></Link>)}</div> : <div className={styles.empty}><Activity /><b>No visible activity yet</b><span>The timeline stays empty rather than inventing company events.</span></div>}
  </section>;
}
