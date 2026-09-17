"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CircleAlert, FileCheck2, LoaderCircle, Plus, ShieldCheck, X } from "lucide-react";
import styles from "./office-data-movement.module.css";

type ScopeOption = { type: string; key: string | null; label: string };
type RequestRow = { id: string; request_type_code: string; title: string; description: string; payload?: Record<string, unknown>; priority: string; status: string; resource_type?: string | null; resource_key?: string | null; due_at?: string | null; submitted_at?: string | null; created_at: string; updated_at: string };
type Approval = { step: { id: string; label: string; status: string }; request: RequestRow | null };
type Payload = { export_scopes: ScopeOption[]; import_scopes: ScopeOption[]; requests: RequestRow[]; approvals: Approval[]; disclaimer: string };

type Kind = "EXPORT" | "IMPORT";
async function api<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-data-movement", { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Data movement request failed");
  return body as T;
}
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()); }
function date(value?: string | null) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(d); }

export function OfficeDataMovement() {
  const [data, setData] = useState<Payload>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [kind, setKind] = useState<Kind>();
  const [draft, setDraft] = useState<Record<string, string>>({ classification: "CONFIDENTIAL", format: "CSV" });
  const [busy, setBusy] = useState(false);

  async function reload(message?: string) { const next = await api<Payload>(); setData(next); if (message) setNotice(message); }
  useEffect(() => { let alive = true; void api<Payload>().then((next) => { if (alive) setData(next); }).catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Unable to load data movement" ); }); return () => { alive = false; }; }, []);
  const scopes = useMemo(() => kind === "EXPORT" ? data?.export_scopes ?? [] : kind === "IMPORT" ? data?.import_scopes ?? [] : [], [data?.export_scopes, data?.import_scopes, kind]);

  function open(nextKind: Kind) {
    const options = nextKind === "EXPORT" ? data?.export_scopes ?? [] : data?.import_scopes ?? [];
    const first = options[0];
    setDraft({ scope: first ? `${first.type}|${first.key ?? ""}` : "", classification: "CONFIDENTIAL", format: nextKind === "EXPORT" ? "CSV" : "OTHER", title: `${label(nextKind)} request` });
    setKind(nextKind);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!kind) return;
    const selected = scopes.find((option) => `${option.type}|${option.key ?? ""}` === draft.scope);
    if (!selected) { setError("Select an authorised data scope."); return; }
    setBusy(true); setError(undefined);
    try {
      await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, scope_type: selected.type, scope_key: selected.key || undefined, title: draft.title, description: draft.description, purpose: draft.purpose, classification: draft.classification, format: draft.format, source_reference: draft.source_reference || undefined }) });
      await reload(`${label(kind)} approval request created. No data was moved.`);
      setKind(undefined);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to request data movement"); }
    finally { setBusy(false); }
  }

  if (error && !data) return <section className={styles.state}><CircleAlert /><div><h2>Data movement unavailable</h2><p>{error}</p></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Loading data movement</h2><p>Resolving scoped export/import authority.</p></div></section>;
  const pending = data.requests.filter((item) => ["PENDING", "IN_REVIEW", "APPROVED"].includes(item.status)).length;

  return <section className={styles.shell}>
    <header className={styles.hero}><div><p>CONTROLLED DATA MOVEMENT</p><h2>Request first. Move data only after separate execution authority.</h2><span>{data.disclaimer}</span></div><div className={styles.actions}>{data.export_scopes.length ? <button type="button" onClick={() => open("EXPORT")}><ArrowDownToLine /> Request export</button> : null}{data.import_scopes.length ? <button type="button" onClick={() => open("IMPORT")}><ArrowUpFromLine /> Request import</button> : null}</div></header>
    <div className={styles.metrics}><article><b>{pending}</b><span>active requests</span></article><article><b>{data.approvals.length}</b><span>assigned approvals</span></article><article><b>{data.export_scopes.length}</b><span>export scopes</span></article><article><b>{data.import_scopes.length}</b><span>import scopes</span></article></div>
    {notice ? <div className={styles.notice}><ShieldCheck />{notice}<button onClick={() => setNotice(undefined)} type="button" aria-label="Dismiss"><X /></button></div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}
    <div className={styles.requests}>{data.requests.map((item) => <article key={item.id}><header><div><code>{item.request_type_code}</code><h3>{item.title}</h3></div><em data-status={item.status}>{label(item.status)}</em></header><p>{item.description}</p><footer><span>{item.resource_type || "Scope"}{item.resource_key ? ` · ${item.resource_key}` : ""}</span><span>{label(item.priority)} · Due {date(item.due_at)}</span></footer></article>)}{!data.requests.length ? <div className={styles.empty}><FileCheck2 /><b>No data movement requests</b><span>No exports or imports are generated merely to populate this workspace.</span></div> : null}</div>

    {kind ? <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && setKind(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><header><div><p>{kind} REQUEST</p><h3>Create governed data {kind.toLowerCase()}</h3></div><button type="button" onClick={() => setKind(undefined)} aria-label="Close"><X /></button></header><p className={styles.warning}>Approval records authority only. This form never downloads, uploads, transforms or writes canonical data.</p><label>Authorised scope<select value={draft.scope || ""} onChange={(e) => setDraft({ ...draft, scope: e.target.value })} required>{scopes.map((option) => <option key={`${option.type}:${option.key ?? ""}`} value={`${option.type}|${option.key ?? ""}`}>{option.label}</option>)}</select></label><label>Title<input value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} minLength={3} maxLength={180} required /></label><label>Description<textarea value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} minLength={3} maxLength={4000} required /></label><label>Business purpose<textarea value={draft.purpose || ""} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} minLength={3} maxLength={1000} required /></label><div className={styles.two}><label>Classification<select value={draft.classification || "CONFIDENTIAL"} onChange={(e) => setDraft({ ...draft, classification: e.target.value })}>{["INTERNAL","CONFIDENTIAL","RESTRICTED"].map((v) => <option key={v}>{v}</option>)}</select></label><label>Requested format<select value={draft.format || "CSV"} onChange={(e) => setDraft({ ...draft, format: e.target.value })}>{["CSV","JSON","PDF","OTHER"].map((v) => <option key={v}>{v}</option>)}</select></label></div><label>Source / destination reference (no secret)<input value={draft.source_reference || ""} onChange={(e) => setDraft({ ...draft, source_reference: e.target.value })} maxLength={500} /></label><footer><button type="button" onClick={() => setKind(undefined)} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <Plus />} Create request</button></footer></form></div> : null}
  </section>;
}
