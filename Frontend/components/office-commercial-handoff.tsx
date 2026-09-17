"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, FileSignature, LoaderCircle, ReceiptText, RefreshCw, ShieldCheck, Waypoints } from "lucide-react";
import styles from "./office-commercial-handoff.module.css";

type RequestRow = { id: string; request_type_code: string; title: string; status: string; due_at?: string | null; completed_at?: string | null };
type Handoff = {
  id: string;
  opportunity_id: string;
  customer_id: string;
  product_id: string;
  status: string;
  contract_request?: RequestRow | null;
  subscription_request?: RequestRow | null;
  invoice_request?: RequestRow | null;
  events?: Array<{ id: string; event_type: string; created_at: string }>;
};
type Opportunity = {
  id: string;
  opportunity_code: string;
  customer_id?: string | null;
  product_id?: string | null;
  title: string;
  value_minor?: number | null;
  currency: string;
  won_at?: string | null;
  handoff?: Handoff | null;
  stages: { contract: string; subscription: string; invoice: string };
};
type Payload = {
  can_write: boolean;
  customers: Array<{ id: string; legal_name: string; display_name?: string | null }>;
  products: Array<{ id: string; code: string; name: string }>;
  opportunities: Opportunity[];
  disclaimer: string;
};
type Stage = "CONTRACT" | "SUBSCRIPTION" | "INVOICE";

async function api<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-commercial", { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Commercial handoff request failed");
  return body as T;
}

function title(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function money(value?: number | null, currency = "INR") {
  if (typeof value !== "number") return "—";
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100); }
  catch { return `${currency} ${(value / 100).toLocaleString("en-IN")}`; }
}

function StageCard({ label, state, icon, action, disabled, busy }: { label: string; state: string; icon: React.ReactNode; action?: () => void; disabled?: boolean; busy?: boolean }) {
  const approved = state === "APPROVED";
  const waiting = !["NOT_STARTED", "LOCKED", "INITIALIZE_REQUIRED", "APPROVED"].includes(state);
  return <article className={styles.stage} data-state={state}>
    <div className={styles.stageIcon}>{approved ? <CheckCircle2 /> : icon}</div>
    <div><span>{label}</span><b>{approved ? "Approved" : state === "NOT_STARTED" ? "Ready" : state === "LOCKED" ? "Waiting for prior stage" : waiting ? title(state) : title(state)}</b></div>
    {action && state === "NOT_STARTED" ? <button type="button" onClick={action} disabled={disabled || busy}>{busy ? <LoaderCircle className={styles.spin} /> : <ArrowRight />} Request</button> : null}
  </article>;
}

export function OfficeCommercialHandoff() {
  const [data, setData] = useState<Payload>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();

  async function reload(message?: string) {
    const next = await api<Payload>();
    setData(next);
    setNotice(message);
  }

  useEffect(() => {
    let alive = true;
    void api<Payload>().then((next) => { if (alive) setData(next); }).catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Unable to load commercial handoff"); });
    return () => { alive = false; };
  }, []);

  const customers = useMemo(() => new Map((data?.customers ?? []).map((item) => [item.id, item])), [data?.customers]);
  const products = useMemo(() => new Map((data?.products ?? []).map((item) => [item.id, item])), [data?.products]);

  async function initialize(opportunity: Opportunity) {
    setBusy(`init:${opportunity.id}`); setError(undefined);
    try {
      await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "INITIALIZE", opportunity_id: opportunity.id }) });
      await reload("Commercial handoff initialized. Legal, subscription and billing remain separately governed.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to initialize handoff"); }
    finally { setBusy(undefined); }
  }

  async function requestStage(handoffId: string, stage: Stage) {
    setBusy(`${handoffId}:${stage}`); setError(undefined);
    try {
      await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE_STAGE_REQUEST", handoff_id: handoffId, stage }) });
      await reload(`${title(stage)} approval request created. No downstream business action was executed automatically.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create approval request"); }
    finally { setBusy(undefined); }
  }

  if (error && !data) return <section className={styles.state}><CircleAlert /><div><h2>Commercial handoff unavailable</h2><p>{error}</p></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Loading commercial handoffs</h2><p>Resolving won opportunities and governed downstream approvals.</p></div></section>;

  return <section className={styles.shell}>
    <header className={styles.hero}><div className={styles.mark}><Waypoints /></div><div><p>COMMERCIAL HANDOFF</p><h2>Won deal → contract → subscription → billing preparation.</h2><span>{data.disclaimer}</span></div><Link href="/office/requests">Open requests <ArrowRight /></Link></header>
    {notice ? <div className={styles.notice}><ShieldCheck />{notice}</div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}

    {data.opportunities.length ? <div className={styles.list}>{data.opportunities.map((opportunity) => {
      const customer = opportunity.customer_id ? customers.get(opportunity.customer_id) : undefined;
      const product = opportunity.product_id ? products.get(opportunity.product_id) : undefined;
      const handoff = opportunity.handoff;
      const ready = Boolean(opportunity.customer_id && opportunity.product_id);
      return <article className={styles.deal} key={opportunity.id}>
        <div className={styles.dealHead}><div><code>{opportunity.opportunity_code}</code><h3>{opportunity.title}</h3><span>{customer?.display_name || customer?.legal_name || "Customer not linked"} · {product?.name || "Product not linked"}</span></div><strong>{money(opportunity.value_minor, opportunity.currency)}</strong></div>
        {!handoff ? <div className={styles.initialize}><div><b>{ready ? "Ready for governed handoff" : "Canonical customer and product required"}</b><span>Starting the handoff creates no contract, subscription or invoice.</span></div>{data.can_write && ready ? <button type="button" onClick={() => initialize(opportunity)} disabled={busy === `init:${opportunity.id}`}>{busy === `init:${opportunity.id}` ? <LoaderCircle className={styles.spin} /> : <RefreshCw />} Start handoff</button> : null}</div> : <>
          <div className={styles.stages}>
            <StageCard label="Contract" state={opportunity.stages.contract} icon={<FileSignature />} action={() => requestStage(handoff.id, "CONTRACT")} disabled={!data.can_write} busy={busy === `${handoff.id}:CONTRACT`} />
            <StageCard label="Subscription" state={opportunity.stages.subscription} icon={<Waypoints />} action={() => requestStage(handoff.id, "SUBSCRIPTION")} disabled={!data.can_write} busy={busy === `${handoff.id}:SUBSCRIPTION`} />
            <StageCard label="Billing prep" state={opportunity.stages.invoice} icon={<ReceiptText />} action={() => requestStage(handoff.id, "INVOICE")} disabled={!data.can_write} busy={busy === `${handoff.id}:INVOICE`} />
          </div>
          <div className={styles.links}>{handoff.contract_request ? <Link href="/office/requests">Contract request · {title(handoff.contract_request.status)}</Link> : null}{handoff.subscription_request ? <Link href="/office/requests">Subscription request · {title(handoff.subscription_request.status)}</Link> : null}{handoff.invoice_request ? <Link href="/office/requests">Billing request · {title(handoff.invoice_request.status)}</Link> : null}</div>
        </>}
      </article>;
    })}</div> : <div className={styles.empty}><Waypoints /><b>No won opportunities need a handoff yet</b><span>The system stays empty instead of creating sample commercial records.</span></div>}
  </section>;
}
