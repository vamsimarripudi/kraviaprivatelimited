"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CircleAlert, DatabaseZap, FileClock, LoaderCircle, LockKeyhole, Plus, Search, ShieldCheck, X } from "lucide-react";
import styles from "./office-privacy-governance.module.css";

type Owner = { user_id: string; display_name?: string | null; job_title?: string | null };
type PrivacyEvent = { id: string; event_type: string; previous_status?: string | null; new_status?: string | null; note?: string | null; created_at: string };
type PrivacyCase = { id: string; case_code: string; case_type: string; subject_type: string; subject_reference: string; jurisdiction: string; title: string; description: string; source_channel: string; status: string; owner_user_id: string; source_reference?: string | null; deadline_at?: string | null; outcome_note?: string | null; completed_at?: string | null; created_at: string; updated_at: string; events: PrivacyEvent[] };
type RetentionRule = { code: string; record_class: string; title: string; jurisdiction: string; retention_period_text: string; retention_basis: string; source_reference: string; status: string; reviewed_at?: string | null };
type LegalHold = { id: string; hold_code: string; title: string; scope_type: string; scope_key: string; reason: string; status: string; placed_at: string; source_reference?: string | null };
type Payload = { actor: { user_id: string }; scope: { type?: string | null; key?: string | null }; can_manage: boolean; can_read_retention: boolean; owners: Owner[]; cases: PrivacyCase[]; retention_rules: RetentionRule[]; legal_holds: LegalHold[]; disclaimer: string };
type Modal = { kind: "CREATE" } | { kind: "TRANSITION"; privacyCase: PrivacyCase };

async function api<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-privacy", { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Privacy request failed");
  return body as T;
}
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()); }
function date(value?: string | null) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(d); }

export function OfficePrivacyGovernance() {
  const [data, setData] = useState<Payload>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cases" | "retention" | "holds">("cases");
  const [modal, setModal] = useState<Modal>();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function reload(message?: string) { const next = await api<Payload>(); setData(next); if (message) setNotice(message); }
  useEffect(() => { let alive = true; void api<Payload>().then((next) => { if (alive) setData(next); }).catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Unable to load privacy governance"); }); return () => { alive = false; }; }, []);
  const ownerMap = useMemo(() => new Map((data?.owners ?? []).map((owner) => [owner.user_id, owner])), [data?.owners]);
  const filtered = useMemo(() => { const n = query.trim().toLowerCase(); if (!n) return data?.cases ?? []; return (data?.cases ?? []).filter((item) => `${item.case_code} ${item.title} ${item.case_type} ${item.subject_type} ${item.status} ${item.jurisdiction}`.toLowerCase().includes(n)); }, [data?.cases, query]);

  function openCreate() { setDraft({ owner_user_id: data?.actor.user_id ?? "", case_type: "ACCESS", subject_type: "CUSTOMER", jurisdiction: "IN", source_channel: "INTERNAL" }); setModal({ kind: "CREATE" }); }
  function openTransition(privacyCase: PrivacyCase) { setDraft({ status: privacyCase.status, note: "" }); setModal({ kind: "TRANSITION", privacyCase }); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!modal) return; setBusy(true); setError(undefined);
    try {
      if (modal.kind === "CREATE") {
        await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE_CASE", owner_user_id: draft.owner_user_id, case_type: draft.case_type, subject_type: draft.subject_type, subject_reference: draft.subject_reference, jurisdiction: draft.jurisdiction || "IN", title: draft.title, description: draft.description, source_channel: draft.source_channel || "INTERNAL", source_reference: draft.source_reference || undefined, deadline_at: draft.deadline_at ? new Date(draft.deadline_at).toISOString() : undefined }) });
        await reload("Privacy case recorded. Any deadline remains evidence-driven and requires legal/professional validation.");
      } else {
        await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "TRANSITION_CASE", case_id: modal.privacyCase.id, status: draft.status, note: draft.note || undefined }) });
        await reload("Privacy workflow state updated with an append-oriented event.");
      }
      setModal(undefined); setDraft({});
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Privacy update failed"); }
    finally { setBusy(false); }
  }

  if (error && !data) return <section className={styles.state}><CircleAlert /><div><h2>Privacy governance unavailable</h2><p>{error}</p></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Loading privacy governance</h2><p>Resolving privacy scope, cases and reviewed records.</p></div></section>;
  const active = data.cases.filter((item) => !["COMPLETED", "REJECTED"].includes(item.status)).length;
  const due = data.cases.filter((item) => item.deadline_at && !["COMPLETED", "REJECTED"].includes(item.status) && new Date(item.deadline_at).getTime() < Date.now()).length;

  return <section className={styles.shell}>
    <header className={styles.hero}><div><p>PRIVACY GOVERNANCE</p><h2>Cases, retention evidence and legal holds.</h2><span>{data.disclaimer}</span></div><div className={styles.metrics}><article><b>{active}</b><span>active cases</span></article><article><b>{due}</b><span>past recorded deadline</span></article>{data.can_manage ? <button type="button" onClick={openCreate}><Plus /> New case</button> : null}</div></header>
    <div className={styles.tabs}>{(["cases","retention","holds"] as const).map((key) => <button type="button" key={key} data-active={view === key} disabled={key !== "cases" && !data.can_read_retention} onClick={() => setView(key)}>{label(key)}</button>)}</div>
    {view === "cases" ? <div className={styles.toolbar}><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search privacy cases" /></label><span>{data.scope.type || "OWNER"}{data.scope.key ? ` · ${data.scope.key}` : ""} scope</span></div> : null}
    {notice ? <div className={styles.notice}><ShieldCheck />{notice}<button type="button" onClick={() => setNotice(undefined)} aria-label="Dismiss"><X /></button></div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}

    {view === "cases" ? <div className={styles.cards}>{filtered.map((item) => <article key={item.id} className={styles.card}><header><div><code>{item.case_code}</code><h3>{item.title}</h3><span>{label(item.case_type)} · {label(item.subject_type)} · {item.jurisdiction}</span></div><em data-status={item.status}>{label(item.status)}</em></header><p>{item.description}</p><div className={styles.meta}><span>Subject ref: {item.subject_reference}</span><span>Owner: {ownerMap.get(item.owner_user_id)?.display_name || ownerMap.get(item.owner_user_id)?.job_title || "Assigned user"}</span><span>Recorded deadline: {date(item.deadline_at)}</span></div>{data.can_manage && !["COMPLETED","REJECTED"].includes(item.status) ? <footer><button type="button" onClick={() => openTransition(item)}><ShieldCheck /> Update workflow</button></footer> : null}</article>)}{!filtered.length ? <div className={styles.empty}><DatabaseZap /><b>No visible privacy cases</b><span>No sample data-subject requests are fabricated.</span></div> : null}</div> : null}

    {view === "retention" ? <div className={styles.cards}>{data.retention_rules.map((rule) => <article className={styles.card} key={rule.code}><header><div><code>{rule.code}</code><h3>{rule.title}</h3><span>{rule.record_class} · {rule.jurisdiction}</span></div><em>{rule.status}</em></header><p>{rule.retention_period_text}</p><div className={styles.meta}><span>Basis: {rule.retention_basis}</span><span>Source: {rule.source_reference}</span><span>Reviewed: {date(rule.reviewed_at)}</span></div></article>)}{!data.retention_rules.length ? <div className={styles.empty}><FileClock /><b>No reviewed retention rules recorded</b><span>The system does not invent statutory retention periods. Add rules only after source and professional review.</span></div> : null}</div> : null}

    {view === "holds" ? <div className={styles.cards}>{data.legal_holds.map((hold) => <article className={styles.card} key={hold.id}><header><div><code>{hold.hold_code}</code><h3>{hold.title}</h3><span>{hold.scope_type} · {hold.scope_key}</span></div><em data-status={hold.status}>{hold.status}</em></header><p>{hold.reason}</p><div className={styles.meta}><span>Placed: {date(hold.placed_at)}</span><span>Source: {hold.source_reference || "Not recorded"}</span></div></article>)}{!data.legal_holds.length ? <div className={styles.empty}><LockKeyhole /><b>No legal holds recorded</b><span>Legal holds are not created implicitly from a policy label or case status.</span></div> : null}</div> : null}

    {modal ? <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && setModal(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><header><div><p>{modal.kind === "CREATE" ? "NEW PRIVACY CASE" : "WORKFLOW TRANSITION"}</p><h3>{modal.kind === "CREATE" ? "Record privacy work" : modal.privacyCase.title}</h3></div><button type="button" onClick={() => setModal(undefined)} aria-label="Close"><X /></button></header>{modal.kind === "CREATE" ? <><label>Owner<select required value={draft.owner_user_id || ""} onChange={(e) => setDraft({ ...draft, owner_user_id: e.target.value })}>{data.owners.map((owner) => <option key={owner.user_id} value={owner.user_id}>{owner.display_name || owner.job_title || owner.user_id}</option>)}</select></label><div className={styles.two}><label>Case type<select value={draft.case_type || "ACCESS"} onChange={(e) => setDraft({ ...draft, case_type: e.target.value })}>{["ACCESS","CORRECTION","ERASURE","CONSENT_WITHDRAWAL","GRIEVANCE","OTHER"].map((v) => <option key={v}>{v}</option>)}</select></label><label>Subject type<select value={draft.subject_type || "CUSTOMER"} onChange={(e) => setDraft({ ...draft, subject_type: e.target.value })}>{["CUSTOMER","EMPLOYEE","PROSPECT","VENDOR","OTHER"].map((v) => <option key={v}>{v}</option>)}</select></label></div><div className={styles.two}><label>Subject reference<input value={draft.subject_reference || ""} onChange={(e) => setDraft({ ...draft, subject_reference: e.target.value })} minLength={2} maxLength={240} required /></label><label>Jurisdiction<input value={draft.jurisdiction || "IN"} onChange={(e) => setDraft({ ...draft, jurisdiction: e.target.value.toUpperCase() })} minLength={2} maxLength={24} required /></label></div><label>Title<input value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} minLength={3} maxLength={180} required /></label><label>Description<textarea value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} minLength={3} maxLength={8000} required /></label><div className={styles.two}><label>Source channel<input value={draft.source_channel || "INTERNAL"} onChange={(e) => setDraft({ ...draft, source_channel: e.target.value })} maxLength={80} /></label><label>Source reference<input value={draft.source_reference || ""} onChange={(e) => setDraft({ ...draft, source_reference: e.target.value })} maxLength={500} /></label></div><label>Recorded deadline (optional)<input type="datetime-local" value={draft.deadline_at || ""} onChange={(e) => setDraft({ ...draft, deadline_at: e.target.value })} /></label><p className={styles.warning}>A recorded deadline is an operational field. It is not calculated as a legal deadline by this form.</p></> : <><label>Status<select value={draft.status || modal.privacyCase.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{["OPEN","VERIFY_IDENTITY","IN_REVIEW","ACTION_REQUIRED","COMPLETED","REJECTED"].map((v) => <option key={v}>{v}</option>)}</select></label><label>Outcome / review note<textarea value={draft.note || ""} onChange={(e) => setDraft({ ...draft, note: e.target.value })} maxLength={4000} placeholder="Required when completing or rejecting a case" /></label></>}
      <footer><button type="button" onClick={() => setModal(undefined)} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <ShieldCheck />} Confirm</button></footer></form></div> : null}
  </section>;
}
