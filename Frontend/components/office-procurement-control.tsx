"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Boxes, CheckCircle2, CircleAlert, FileCheck2, LoaderCircle, Plus, ReceiptText, RefreshCw, ShoppingCart, X } from "lucide-react";
import styles from "./office-procurement-control.module.css";

type Person = { user_id: string; display_name?: string | null; job_title?: string | null; primary_department?: string | null };
type RequestRow = { id: string; request_code: string; requester_user_id: string; owner_user_id: string; department_code?: string | null; category: string; title: string; business_need: string; quantity: number; estimated_amount_minor: number; currency: string; required_by?: string | null; budget_reference?: string | null; preferred_vendor_name?: string | null; risk_note?: string | null; status: string; approval_request_id?: string | null; selected_quote_id?: string | null; created_at: string; updated_at: string };
type Quote = { id: string; procurement_request_id: string; vendor_name: string; quoted_amount_minor: number; currency: string; source_reference: string; comparison_note?: string | null; selected: boolean; validity_until?: string | null };
type PurchaseOrder = { id: string; po_code: string; procurement_request_id: string; vendor_name: string; amount_minor: number; currency: string; issue_reference: string; status: string; issued_at: string };
type Receipt = { id: string; receipt_code: string; purchase_order_id: string; acceptance_status: string; quantity_received?: number | null; evidence_reference: string; recorded_at: string };
type Renewal = { id: string; renewal_code: string; owner_user_id: string; department_code?: string | null; vendor_name: string; service_name: string; service_category: string; renewal_at: string; notice_at?: string | null; expected_amount_minor?: number | null; currency?: string | null; auto_renew: boolean; status: string; source_reference: string };
type Approval = { id: string; status: string; priority: string; current_step_order?: number | null; due_at?: string | null };
type Payload = {
  actor: { user_id: string; department?: string | null };
  scope: { type?: string | null; key?: string | null };
  capabilities: { prepare: boolean; issue_po: boolean; record_receipt: boolean; manage_renewal: boolean };
  people: Person[];
  requests: RequestRow[];
  quotes: Quote[];
  purchase_orders: PurchaseOrder[];
  receipts: Receipt[];
  renewals: Renewal[];
  approvals: Approval[];
  disclaimer: string;
};
type Modal =
  | { kind: "CREATE" }
  | { kind: "QUOTE"; request: RequestRow }
  | { kind: "PO"; request: RequestRow }
  | { kind: "RECEIPT"; po: PurchaseOrder }
  | { kind: "RENEWAL" };

async function api<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-procurement", { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Procurement request failed");
  return body as T;
}
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()); }
function minor(value: string) { const amount = Number(value); return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : undefined; }
function money(value: number | null | undefined, currency = "INR") { if (typeof value !== "number") return "—"; try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100); } catch { return `${currency} ${(value / 100).toLocaleString("en-IN")}`; } }
function date(value?: string | null) { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(parsed); }

export function OfficeProcurementControl() {
  const [data, setData] = useState<Payload>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [modal, setModal] = useState<Modal>();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"requests" | "renewals">("requests");

  async function reload(message?: string) { const next = await api<Payload>(); setData(next); if (message) setNotice(message); }
  useEffect(() => { let alive = true; void api<Payload>().then((next) => { if (alive) setData(next); }).catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Unable to load procurement"); }); return () => { alive = false; }; }, []);

  const people = useMemo(() => new Map((data?.people ?? []).map((person) => [person.user_id, person])), [data?.people]);
  const quotesByRequest = useMemo(() => {
    const map = new Map<string, Quote[]>();
    for (const quote of data?.quotes ?? []) { const rows = map.get(quote.procurement_request_id) ?? []; rows.push(quote); map.set(quote.procurement_request_id, rows); }
    return map;
  }, [data?.quotes]);
  const poByRequest = useMemo(() => new Map((data?.purchase_orders ?? []).map((po) => [po.procurement_request_id, po])), [data?.purchase_orders]);
  const approvalMap = useMemo(() => new Map((data?.approvals ?? []).map((approval) => [approval.id, approval])), [data?.approvals]);
  const receiptsByPo = useMemo(() => {
    const map = new Map<string, Receipt[]>();
    for (const receipt of data?.receipts ?? []) { const rows = map.get(receipt.purchase_order_id) ?? []; rows.push(receipt); map.set(receipt.purchase_order_id, rows); }
    return map;
  }, [data?.receipts]);

  function openCreate() { setDraft({ owner_user_id: data?.actor.user_id ?? "", department: data?.actor.department ?? "", category: "SOFTWARE", quantity: "1", currency: "INR" }); setModal({ kind: "CREATE" }); }
  function openQuote(request: RequestRow) { setDraft({ currency: request.currency, vendor_name: request.preferred_vendor_name ?? "" }); setModal({ kind: "QUOTE", request }); }
  function openPo(request: RequestRow) { setDraft({ issue_reference: "", terms: "", tax_note: "" }); setModal({ kind: "PO", request }); }
  function openReceipt(po: PurchaseOrder) { setDraft({ status: "ACCEPTED", quantity: "", evidence_reference: "", note: "" }); setModal({ kind: "RECEIPT", po }); }
  function openRenewal() { setDraft({ owner_user_id: data?.actor.user_id ?? "", department: data?.actor.department ?? "", category: "SOFTWARE", currency: "INR", auto_renew: "false" }); setModal({ kind: "RENEWAL" }); }

  async function action(payload: Record<string, unknown>, message: string) {
    setBusy(true); setError(undefined);
    try { await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); await reload(message); setModal(undefined); setDraft({}); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Procurement update failed"); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!modal) return;
    if (modal.kind === "CREATE") {
      const amount = minor(draft.amount); if (amount === undefined) return setError("Enter a valid estimated amount.");
      return action({ action: "CREATE_REQUEST", owner_user_id: draft.owner_user_id, department: draft.department || undefined, category: draft.category, title: draft.title, business_need: draft.business_need, quantity: Number(draft.quantity || "1"), amount_minor: amount, currency: draft.currency || "INR", required_by: draft.required_by || undefined, budget_reference: draft.budget_reference || undefined, vendor_name: draft.vendor_name || undefined, risk_note: draft.risk_note || undefined }, "Purchase request created as a draft. Approval and payment remain separate controls.");
    }
    if (modal.kind === "QUOTE") {
      const amount = minor(draft.amount); if (amount === undefined) return setError("Enter a valid quoted amount.");
      return action({ action: "ADD_QUOTE", request_id: modal.request.id, vendor_name: draft.vendor_name, amount_minor: amount, currency: draft.currency || modal.request.currency, tax_note: draft.tax_note || undefined, terms: draft.terms || undefined, validity_until: draft.validity_until || undefined, source_reference: draft.source_reference, comparison_note: draft.comparison_note || undefined }, "Vendor quote recorded with its source reference.");
    }
    if (modal.kind === "PO") return action({ action: "ISSUE_PO", request_id: modal.request.id, issue_reference: draft.issue_reference, terms: draft.terms || undefined, tax_note: draft.tax_note || undefined }, "Purchase order issued from an independently approved request. No bank payment was released.");
    if (modal.kind === "RECEIPT") return action({ action: "RECORD_RECEIPT", purchase_order_id: modal.po.id, status: draft.status, quantity: draft.quantity ? Number(draft.quantity) : undefined, service_period: draft.service_period || undefined, evidence_reference: draft.evidence_reference, note: draft.note || undefined }, "Receipt/acceptance evidence recorded. Finance payment remains a separate workflow.");
    const amount = draft.amount ? minor(draft.amount) : undefined;
    return action({ action: "CREATE_RENEWAL", owner_user_id: draft.owner_user_id, department: draft.department || undefined, vendor_name: draft.vendor_name, service_name: draft.service_name, category: draft.category, renewal_at: new Date(draft.renewal_at).toISOString(), notice_at: draft.notice_at ? new Date(draft.notice_at).toISOString() : undefined, amount_minor: amount, currency: draft.currency || undefined, auto_renew: draft.auto_renew === "true", contract_reference: draft.contract_reference || undefined, source_reference: draft.source_reference }, "Renewal tracked. Renewal execution remains governed and separate from payment.");
  }

  if (error && !data) return <section className={styles.state}><CircleAlert /><div><h2>Procurement unavailable</h2><p>{error}</p></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Loading procurement controls</h2><p>Resolving request, approval, PO, receipt and renewal records.</p></div></section>;
  const open = data.requests.filter((row) => !["CANCELLED", "CLOSED", "RECEIVED"].includes(row.status)).length;
  const pendingRenewals = data.renewals.filter((row) => !["RENEWED", "CANCELLED", "EXPIRED"].includes(row.status)).length;

  return <section className={styles.shell}>
    <header className={styles.hero}><div><p>PROCUREMENT CONTROL</p><h2>Request → compare → approve → PO → receipt.</h2><span>{data.disclaimer}</span></div><div className={styles.metrics}><article><b>{open}</b><span>open purchases</span></article><article><b>{pendingRenewals}</b><span>tracked renewals</span></article>{data.capabilities.prepare ? <button type="button" onClick={openCreate}><Plus /> Purchase request</button> : null}</div></header>
    <div className={styles.tabs}><button type="button" data-active={view === "requests"} onClick={() => setView("requests")}>Purchases</button><button type="button" data-active={view === "renewals"} onClick={() => setView("renewals")}>Renewals</button>{data.capabilities.manage_renewal ? <button type="button" className={styles.secondary} onClick={openRenewal}><Plus /> Track renewal</button> : null}</div>
    {notice ? <div className={styles.notice}><CheckCircle2 />{notice}<button type="button" onClick={() => setNotice(undefined)} aria-label="Dismiss"><X /></button></div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}

    {view === "requests" ? <div className={styles.list}>{data.requests.map((request) => {
      const quotes = quotesByRequest.get(request.id) ?? [];
      const po = poByRequest.get(request.id);
      const approval = request.approval_request_id ? approvalMap.get(request.approval_request_id) : undefined;
      return <article className={styles.card} key={request.id}><header><div><code>{request.request_code}</code><h3>{request.title}</h3><span>{label(request.category)} · {request.department_code || "Company"}</span></div><em data-status={request.status}>{label(request.status)}</em></header><p>{request.business_need}</p><div className={styles.grid}><span>Owner<b>{people.get(request.owner_user_id)?.display_name || people.get(request.owner_user_id)?.job_title || "Assigned user"}</b></span><span>Estimate<b>{money(request.estimated_amount_minor, request.currency)}</b></span><span>Required by<b>{date(request.required_by)}</b></span><span>Approval<b>{approval ? label(approval.status) : "Not submitted"}</b></span></div>
        <div className={styles.quotes}>{quotes.map((quote) => <div key={quote.id} data-selected={quote.selected}><div><b>{quote.vendor_name}</b><span>{money(quote.quoted_amount_minor, quote.currency)} · {quote.source_reference}</span></div>{data.capabilities.prepare && request.status === "DRAFT" && !quote.selected ? <button type="button" onClick={() => void action({ action: "SELECT_QUOTE", request_id: request.id, quote_id: quote.id }, "Quote selected for the governed approval request.")} disabled={busy}>Select</button> : quote.selected ? <strong>Selected</strong> : null}</div>)}</div>
        <footer>{data.capabilities.prepare && request.status === "DRAFT" ? <><button type="button" onClick={() => openQuote(request)}><ReceiptText /> Add quote</button><button type="button" onClick={() => void action({ action: "SUBMIT_REQUEST", request_id: request.id }, "Purchase request submitted to the configured approval workflow.")} disabled={busy || !request.selected_quote_id}><FileCheck2 /> Submit</button></> : null}{request.approval_request_id && !["REJECTED", "CLOSED", "CANCELLED"].includes(request.status) ? <button type="button" onClick={() => void action({ action: "SYNC_APPROVAL", request_id: request.id }, "Purchase approval state synchronized from the governed request.")} disabled={busy}><RefreshCw /> Sync approval</button> : null}{data.capabilities.issue_po && request.status === "APPROVED" && !po ? <button type="button" onClick={() => openPo(request)}><ShoppingCart /> Issue PO</button> : null}{po ? <div className={styles.po}><b>{po.po_code}</b><span>{po.vendor_name} · {label(po.status)}</span>{data.capabilities.record_receipt && !["RECEIVED", "CLOSED", "CANCELLED"].includes(po.status) ? <button type="button" onClick={() => openReceipt(po)}><Boxes /> Record receipt</button> : null}<small>{(receiptsByPo.get(po.id) ?? []).length} receipt event(s)</small></div> : null}</footer>
      </article>;
    })}{!data.requests.length ? <div className={styles.empty}><ShoppingCart /><b>No purchase requests in scope</b><span>No sample spend is created. Start with a real business need and source-backed quote.</span></div> : null}</div> : <div className={styles.list}>{data.renewals.map((renewal) => <article className={styles.card} key={renewal.id}><header><div><code>{renewal.renewal_code}</code><h3>{renewal.service_name}</h3><span>{renewal.vendor_name} · {label(renewal.service_category)}</span></div><em data-status={renewal.status}>{label(renewal.status)}</em></header><div className={styles.grid}><span>Renewal<b>{date(renewal.renewal_at)}</b></span><span>Notice date<b>{date(renewal.notice_at)}</b></span><span>Expected cost<b>{money(renewal.expected_amount_minor, renewal.currency || "INR")}</b></span><span>Auto renew<b>{renewal.auto_renew ? "Yes" : "No"}</b></span></div><p>Source: {renewal.source_reference}</p></article>)}{!data.renewals.length ? <div className={styles.empty}><RefreshCw /><b>No renewals tracked</b><span>Track real software, cloud, domain and service renewals before they become surprises.</span></div> : null}</div>}

    {modal ? <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && setModal(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><header><div><p>{modal.kind}</p><h3>{modal.kind === "CREATE" ? "Create purchase request" : modal.kind === "QUOTE" ? `Quote · ${modal.request.title}` : modal.kind === "PO" ? `Issue PO · ${modal.request.title}` : modal.kind === "RECEIPT" ? `Receipt · ${modal.po.po_code}` : "Track vendor renewal"}</h3></div><button type="button" onClick={() => setModal(undefined)} aria-label="Close"><X /></button></header>
      {modal.kind === "CREATE" ? <><label>Owner<select required value={draft.owner_user_id || ""} onChange={(e) => setDraft({ ...draft, owner_user_id: e.target.value })}>{data.people.map((person) => <option value={person.user_id} key={person.user_id}>{person.display_name || person.job_title || person.user_id}</option>)}</select></label><div className={styles.two}><label>Department<input value={draft.department || ""} onChange={(e) => setDraft({ ...draft, department: e.target.value.toUpperCase() })} /></label><label>Category<select value={draft.category || "SOFTWARE"} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{["SOFTWARE","CLOUD","HARDWARE","PROFESSIONAL_SERVICE","OFFICE","TRAVEL","MARKETING","OTHER"].map((v) => <option key={v}>{v}</option>)}</select></label></div><label>Title<input required minLength={3} maxLength={220} value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label><label>Business need<textarea required minLength={3} value={draft.business_need || ""} onChange={(e) => setDraft({ ...draft, business_need: e.target.value })} /></label><div className={styles.three}><label>Quantity<input type="number" min="0.001" step="0.001" required value={draft.quantity || "1"} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></label><label>Estimate<input inputMode="decimal" required value={draft.amount || ""} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></label><label>Currency<input minLength={3} maxLength={3} required value={draft.currency || "INR"} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} /></label></div><div className={styles.two}><label>Required by<input type="date" value={draft.required_by || ""} onChange={(e) => setDraft({ ...draft, required_by: e.target.value })} /></label><label>Budget reference<input value={draft.budget_reference || ""} onChange={(e) => setDraft({ ...draft, budget_reference: e.target.value })} /></label></div><label>Preferred vendor<input value={draft.vendor_name || ""} onChange={(e) => setDraft({ ...draft, vendor_name: e.target.value })} /></label><label>Risk / exception note<textarea value={draft.risk_note || ""} onChange={(e) => setDraft({ ...draft, risk_note: e.target.value })} /></label></> : modal.kind === "QUOTE" ? <><label>Vendor<input required minLength={2} value={draft.vendor_name || ""} onChange={(e) => setDraft({ ...draft, vendor_name: e.target.value })} /></label><div className={styles.two}><label>Quoted amount<input inputMode="decimal" required value={draft.amount || ""} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></label><label>Currency<input minLength={3} maxLength={3} required value={draft.currency || "INR"} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} /></label></div><label>Source reference<input required minLength={3} value={draft.source_reference || ""} onChange={(e) => setDraft({ ...draft, source_reference: e.target.value })} /></label><label>Commercial terms<textarea value={draft.terms || ""} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} /></label><div className={styles.two}><label>Validity<input type="date" value={draft.validity_until || ""} onChange={(e) => setDraft({ ...draft, validity_until: e.target.value })} /></label><label>Tax note<input value={draft.tax_note || ""} onChange={(e) => setDraft({ ...draft, tax_note: e.target.value })} /></label></div><label>Comparison note<textarea value={draft.comparison_note || ""} onChange={(e) => setDraft({ ...draft, comparison_note: e.target.value })} /></label></> : modal.kind === "PO" ? <><p className={styles.warning}>PO issue is permitted only after independent approval. It never executes a bank transfer.</p><label>Issue reference<input required minLength={3} value={draft.issue_reference || ""} onChange={(e) => setDraft({ ...draft, issue_reference: e.target.value })} /></label><label>Terms<textarea value={draft.terms || ""} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} /></label><label>Tax note<input value={draft.tax_note || ""} onChange={(e) => setDraft({ ...draft, tax_note: e.target.value })} /></label></> : modal.kind === "RECEIPT" ? <><label>Acceptance<select value={draft.status || "ACCEPTED"} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{["PARTIAL","ACCEPTED","REJECTED"].map((v) => <option key={v}>{v}</option>)}</select></label><div className={styles.two}><label>Quantity received<input type="number" min="0" step="0.001" value={draft.quantity || ""} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></label><label>Service period<input value={draft.service_period || ""} onChange={(e) => setDraft({ ...draft, service_period: e.target.value })} /></label></div><label>Evidence reference<input required minLength={3} value={draft.evidence_reference || ""} onChange={(e) => setDraft({ ...draft, evidence_reference: e.target.value })} /></label><label>Note<textarea value={draft.note || ""} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label></> : <><label>Owner<select required value={draft.owner_user_id || ""} onChange={(e) => setDraft({ ...draft, owner_user_id: e.target.value })}>{data.people.map((person) => <option value={person.user_id} key={person.user_id}>{person.display_name || person.job_title || person.user_id}</option>)}</select></label><div className={styles.two}><label>Vendor<input required minLength={2} value={draft.vendor_name || ""} onChange={(e) => setDraft({ ...draft, vendor_name: e.target.value })} /></label><label>Service<input required minLength={2} value={draft.service_name || ""} onChange={(e) => setDraft({ ...draft, service_name: e.target.value })} /></label></div><div className={styles.three}><label>Category<select value={draft.category || "SOFTWARE"} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{["SOFTWARE","CLOUD","DOMAIN","EMAIL","SECURITY","PROFESSIONAL_SERVICE","OTHER"].map((v) => <option key={v}>{v}</option>)}</select></label><label>Renewal time<input type="datetime-local" required value={draft.renewal_at || ""} onChange={(e) => setDraft({ ...draft, renewal_at: e.target.value })} /></label><label>Notice time<input type="datetime-local" value={draft.notice_at || ""} onChange={(e) => setDraft({ ...draft, notice_at: e.target.value })} /></label></div><div className={styles.three}><label>Expected amount<input inputMode="decimal" value={draft.amount || ""} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></label><label>Currency<input minLength={3} maxLength={3} value={draft.currency || "INR"} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} /></label><label>Auto renew<select value={draft.auto_renew || "false"} onChange={(e) => setDraft({ ...draft, auto_renew: e.target.value })}><option value="false">No</option><option value="true">Yes</option></select></label></div><label>Contract reference<input value={draft.contract_reference || ""} onChange={(e) => setDraft({ ...draft, contract_reference: e.target.value })} /></label><label>Source reference<input required minLength={3} value={draft.source_reference || ""} onChange={(e) => setDraft({ ...draft, source_reference: e.target.value })} /></label></>}
      <footer><button type="button" onClick={() => setModal(undefined)} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <CheckCircle2 />} Confirm</button></footer></form></div> : null}
  </section>;
}
