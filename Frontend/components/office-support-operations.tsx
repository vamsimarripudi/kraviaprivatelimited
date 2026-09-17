"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CircleAlert, Headphones, LoaderCircle, Plus, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import styles from "./office-support-operations.module.css";

type Person = { user_id: string; display_name?: string | null; job_title?: string | null };
type Customer = { id: string; legal_name: string; display_name?: string | null };
type Product = { id: string; code: string; name: string };
type Event = { id: string; event_type: string; previous_status?: string | null; new_status?: string | null; note?: string | null; created_at: string };
type SupportCase = {
  id: string; case_code: string; customer_id?: string | null; product_id?: string | null; subject: string; description: string;
  category: string; source: string; priority: string; status: string; owner_user_id: string; resolution?: string | null; due_at?: string | null;
  created_at: string; updated_at: string; events: Event[];
};
type Payload = {
  actor: { user_id: string }; scope: { type?: string | null; key?: string | null }; can_manage: boolean; can_request_refund: boolean;
  owners: Person[]; customers: Customer[]; products: Product[]; cases: SupportCase[]; disclaimer: string;
};

type Modal = { kind: "CREATE" } | { kind: "TRANSITION"; supportCase: SupportCase } | { kind: "REFUND"; supportCase: SupportCase };

async function api<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-support", { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Support request failed");
  return body as T;
}
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()); }
function moneyMinor(value: string) { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined; }

export function OfficeSupportOperations() {
  const [data, setData] = useState<Payload>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<Modal>();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  async function reload(message?: string) { const next = await api<Payload>(); setData(next); if (message) setNotice(message); }
  useEffect(() => { let alive = true; void api<Payload>().then((next) => { if (alive) setData(next); }).catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Unable to load support operations"); }); return () => { alive = false; }; }, []);

  const customers = useMemo(() => new Map((data?.customers ?? []).map((item) => [item.id, item])), [data?.customers]);
  const products = useMemo(() => new Map((data?.products ?? []).map((item) => [item.id, item])), [data?.products]);
  const owners = useMemo(() => new Map((data?.owners ?? []).map((item) => [item.user_id, item])), [data?.owners]);
  const visibleCases = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data?.cases ?? [];
    return (data?.cases ?? []).filter((item) => `${item.case_code} ${item.subject} ${item.status} ${item.priority} ${item.category}`.toLowerCase().includes(needle));
  }, [data?.cases, query]);

  function openCreate() { setDraft({ owner_user_id: data?.actor.user_id ?? "", source: "INTERNAL", priority: "NORMAL", category: "GENERAL" }); setModal({ kind: "CREATE" }); }
  function openTransition(supportCase: SupportCase) { setDraft({ status: supportCase.status, note: "" }); setModal({ kind: "TRANSITION", supportCase }); }
  function openRefund(supportCase: SupportCase) { setDraft({ amount: "", currency: "INR", reason: "" }); setModal({ kind: "REFUND", supportCase }); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!modal) return; setBusy(true); setError(undefined);
    try {
      if (modal.kind === "CREATE") {
        await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE_CASE", owner_user_id: draft.owner_user_id, customer_id: draft.customer_id || undefined, product_id: draft.product_id || undefined, subject: draft.subject, description: draft.description, category: draft.category || "GENERAL", source: draft.source || "INTERNAL", priority: draft.priority || "NORMAL" }) });
        await reload("Support case created. Financial remedies remain separate approval workflows.");
      } else if (modal.kind === "TRANSITION") {
        await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "TRANSITION_CASE", case_id: modal.supportCase.id, status: draft.status, note: draft.note || undefined }) });
        await reload("Support case status updated with an auditable event.");
      } else {
        const amount = moneyMinor(draft.amount);
        if (!amount) throw new Error("Enter a valid refund amount.");
        await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "REQUEST_REFUND", case_id: modal.supportCase.id, amount_minor: amount, currency: draft.currency || "INR", reason: draft.reason }) });
        await reload("Refund approval request created. No payment or credit was executed.");
      }
      setModal(undefined); setDraft({});
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Support update failed"); }
    finally { setBusy(false); }
  }

  if (error && !data) return <section className={styles.state}><CircleAlert /><div><h2>Support operations unavailable</h2><p>{error}</p></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Loading support operations</h2><p>Resolving your support scope and canonical cases.</p></div></section>;

  const openCount = data.cases.filter((item) => !["RESOLVED", "CLOSED"].includes(item.status)).length;
  const urgent = data.cases.filter((item) => item.priority === "URGENT" && item.status !== "CLOSED").length;
  return <section className={styles.shell}>
    <header className={styles.hero}><div><p>SUPPORT OPERATIONS</p><h2>Customer cases with controlled remedies.</h2><span>{data.disclaimer}</span></div><div className={styles.metrics}><article><b>{openCount}</b><span>open cases</span></article><article><b>{urgent}</b><span>urgent</span></article>{data.can_manage ? <button type="button" onClick={openCreate}><Plus /> New case</button> : null}</div></header>
    <div className={styles.toolbar}><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search case, status or priority" /></label><span>{data.scope.type || "OWNER"}{data.scope.key ? ` · ${data.scope.key}` : ""} scope</span></div>
    {notice ? <div className={styles.notice}><ShieldCheck />{notice}<button type="button" onClick={() => setNotice(undefined)} aria-label="Dismiss"><X /></button></div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}
    <div className={styles.cases}>{visibleCases.map((item) => <article key={item.id} className={styles.case}>
      <header><div><code>{item.case_code}</code><h3>{item.subject}</h3><span>{item.customer_id ? customers.get(item.customer_id)?.display_name || customers.get(item.customer_id)?.legal_name || "Customer" : "Internal / unlinked"}{item.product_id ? ` · ${products.get(item.product_id)?.name || "Product"}` : ""}</span></div><div><b data-priority={item.priority}>{label(item.priority)}</b><em data-status={item.status}>{label(item.status)}</em></div></header>
      <p>{item.description}</p><footer><span>Owner: {owners.get(item.owner_user_id)?.display_name || owners.get(item.owner_user_id)?.job_title || "Assigned user"}</span><span>{item.category} · {item.source}</span><div>{data.can_manage && item.status !== "CLOSED" ? <button type="button" onClick={() => openTransition(item)}><RotateCcw /> Update</button> : null}{data.can_request_refund && item.customer_id && item.status !== "CLOSED" ? <button type="button" onClick={() => openRefund(item)}><ShieldCheck /> Refund request</button> : null}</div></footer>
    </article>)}{!visibleCases.length ? <div className={styles.empty}><Headphones /><b>No visible support cases</b><span>The workspace stays empty instead of generating sample customer issues.</span></div> : null}</div>

    {modal ? <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && setModal(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><header><div><p>{modal.kind === "CREATE" ? "NEW SUPPORT CASE" : modal.kind === "REFUND" ? "CONTROLLED REMEDY" : "CASE TRANSITION"}</p><h3>{modal.kind === "CREATE" ? "Create governed support case" : modal.supportCase.subject}</h3></div><button type="button" onClick={() => setModal(undefined)} aria-label="Close"><X /></button></header>
      {modal.kind === "CREATE" ? <><label>Owner<select value={draft.owner_user_id || ""} onChange={(e) => setDraft({ ...draft, owner_user_id: e.target.value })} required>{data.owners.map((owner) => <option value={owner.user_id} key={owner.user_id}>{owner.display_name || owner.job_title || owner.user_id}</option>)}</select></label><div className={styles.two}><label>Customer<select value={draft.customer_id || ""} onChange={(e) => setDraft({ ...draft, customer_id: e.target.value })}><option value="">Unlinked</option>{data.customers.map((item) => <option key={item.id} value={item.id}>{item.display_name || item.legal_name}</option>)}</select></label><label>Product<select value={draft.product_id || ""} onChange={(e) => setDraft({ ...draft, product_id: e.target.value })}><option value="">Unlinked</option>{data.products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><label>Subject<input value={draft.subject || ""} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} minLength={3} maxLength={180} required /></label><label>Description<textarea value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} minLength={3} maxLength={8000} required /></label><div className={styles.three}><label>Priority<select value={draft.priority || "NORMAL"} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>{["LOW","NORMAL","HIGH","URGENT"].map((v) => <option key={v}>{v}</option>)}</select></label><label>Source<select value={draft.source || "INTERNAL"} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>{["INTERNAL","EMAIL","PHONE","WEB","OTHER"].map((v) => <option key={v}>{v}</option>)}</select></label><label>Category<input value={draft.category || "GENERAL"} onChange={(e) => setDraft({ ...draft, category: e.target.value })} maxLength={80} /></label></div></> : modal.kind === "TRANSITION" ? <><label>Status<select value={draft.status || modal.supportCase.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{["OPEN","IN_PROGRESS","WAITING_CUSTOMER","RESOLVED","CLOSED"].map((v) => <option key={v}>{v}</option>)}</select></label><label>Note<textarea value={draft.note || ""} onChange={(e) => setDraft({ ...draft, note: e.target.value })} maxLength={4000} placeholder="Resolution is mandatory when marking Resolved" /></label></> : <><p className={styles.warning}>This creates a maker-checker refund request only. It cannot issue a credit note, refund or payment.</p><div className={styles.two}><label>Amount<input inputMode="decimal" value={draft.amount || ""} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} required /></label><label>Currency<input value={draft.currency || "INR"} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} minLength={3} maxLength={3} required /></label></div><label>Reason<textarea value={draft.reason || ""} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} minLength={3} maxLength={2000} required /></label></>}
      <footer><button type="button" onClick={() => setModal(undefined)} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <ShieldCheck />} Confirm</button></footer></form></div> : null}
  </section>;
}
