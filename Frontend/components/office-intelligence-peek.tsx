"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrainCircuit, ChevronRight, CircleAlert, RefreshCw, X } from "lucide-react";
import styles from "./office-intelligence-peek.module.css";

type Attention = { key: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO"; area: string; title: string; detail: string; href: string };
type Brief = {
  generated_at: string;
  attention: Attention[];
  data_quality: { degraded: boolean; unavailable_sources: string[] };
};

/** Explicitly opened, read-only executive preview. It performs no background
 * polling and never grants access to non-executive Office identities. */
export function OfficeIntelligencePeek() {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState<Brief>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/office-intelligence", { cache: "no-store", credentials: "same-origin", signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Executive brief unavailable");
      setBrief(body as Brief);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Unable to load company intelligence");
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const outside = (event: MouseEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    document.addEventListener("mousedown", outside);
    return () => {
      controller.abort();
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("mousedown", outside);
    };
  }, [open, refresh]);

  return <div className={styles.root} ref={root}>
    <button className={styles.trigger} type="button" aria-label="Company intelligence"
      title="Company intelligence" aria-expanded={open} aria-controls="office-intelligence-peek"
      onClick={() => setOpen(v => !v)}><BrainCircuit size={20} aria-hidden="true"/></button>
    {open ? <section className={styles.card} id="office-intelligence-peek" aria-label="Company intelligence">
      <header className={styles.heading}>
        <div><strong>Company intelligence</strong><small>Verified sources · read-only</small></div>
        <div className={styles.actions}>
          <button type="button" onClick={() => void refresh()} disabled={busy} aria-label="Refresh company intelligence"><RefreshCw size={16}/></button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close company intelligence"><X size={16}/></button>
        </div>
      </header>
      {busy && !brief ? <p className={styles.state} role="status">Reading current company records…</p> : null}
      {error ? <p className={styles.error} role="alert"><CircleAlert size={16}/>{error}</p> : null}
      {brief ? <>
        {brief.data_quality?.degraded ? <p className={styles.warning} role="status">
          Partial data: {brief.data_quality.unavailable_sources.join(", ")} unavailable.
        </p> : null}
        <div className={styles.list}>{brief.attention.slice(0, 4).map(entry =>
          <Link href={entry.href} key={entry.key} className={styles.item}
            data-severity={entry.severity} onClick={() => setOpen(false)}>
            <span><small>{entry.area} · {entry.severity}</small><strong>{entry.title}</strong>
              <em>{entry.detail}</em></span><ChevronRight size={17}/>
          </Link>)}</div>
        <small className={styles.timestamp}>Updated {new Date(brief.generated_at).toLocaleTimeString("en-IN", {hour: "2-digit", minute: "2-digit"})}</small>
      </> : null}
      <Link className={styles.openFull} href="/office/intelligence" onClick={() => setOpen(false)}>
        View full intelligence brief <ChevronRight size={16}/>
      </Link>
    </section> : null}
  </div>;
}
