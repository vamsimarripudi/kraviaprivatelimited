"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleAlert, Database, FileCheck2, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import styles from "./office-gst-tax.module.css";

type GstSummary = {
  net_taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  invoice_count: number;
  filing_status: string;
  note: string;
};

type Invoice = {
  id: string;
  invoice_no: string;
  status: string;
  issued_at: string;
  customer_id: string;
  product_id: string;
  net_taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  currency: string;
  document_hash: string;
};

type Customer = {
  id: string;
  legal_name: string;
  display_name: string;
  gstin?: string | null;
  billing_address?: string | null;
  billing_locality?: string | null;
  billing_pincode?: string | null;
};

type Product = {
  id: string;
  code: string;
  name: string;
};

type GstMaster = {
  verified_on: string;
  standard_rates: string[];
  it_services: {
    default_rate: string;
    heading: string;
    sacs: { code: string; description: string }[];
    classification_note: string;
  };
  calculation: {
    intra_state: string;
    inter_state: string;
    zero_rate_note: string;
  };
};

type ProductTaxProfile = {
  id: string;
  product_id: string;
  product_code?: string | null;
  product_name: string;
  sac: string;
  gst_rate: string;
  tax_treatment: string;
  supply_model: string;
  billing_enabled: boolean;
  status: string;
  classification_basis: string;
  source_ref: string;
  approved_by?: string | null;
  approved_at?: string | null;
  evidence_ref?: string | null;
};

type GstConfiguration = {
  gstin: {
    configured: boolean;
    masked?: string | null;
    structure_valid: boolean;
    state_matches: boolean;
    state_code?: string | null;
    portal_verification: string;
    note: string;
  };
  tax_config_approved: boolean;
  profiles: {
    configured: number;
    billing_enabled: number;
    approved_billing: number;
    pending_billing: number;
  };
  ready_for_production_invoicing: boolean;
  portal_verification: string;
  authoritative_gstin?: {
    provider: string;
    registration_status?: string | null;
    legal_name?: string | null;
    trade_name?: string | null;
    verified_at: string;
    response_hash: string;
  } | null;
  note: string;
};

type GstConnectorStatus = {
  provider: string;
  environment: string;
  base_host?: string | null;
  core_configured: boolean;
  einvoice_enabled: boolean;
  invoice_identity_configured: boolean;
  ready_for_live_irn: boolean;
  missing_configuration: string[];
  gstin_masked?: string | null;
  last_gstin_verification?: {
    gstin: string;
    legal_name?: string | null;
    trade_name?: string | null;
    registration_status?: string | null;
    verified_at: string;
  } | null;
  last_operation?: {
    operation: string;
    status: string;
    created_at?: string | null;
    error_code?: string | null;
  } | null;
  secret_storage: string;
};

type EinvoiceRecord = {
  id: string;
  invoice_id: string;
  provider: string;
  environment: string;
  status: string;
  irn?: string | null;
  ack_no?: string | null;
  ack_at?: string | null;
  generated_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason_code?: string | null;
  cancel_remarks?: string | null;
  last_error?: string | null;
};

type WorkingTotals = {
  netTaxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  invoiceCount: number;
};

async function runtime<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/office-runtime/" + path, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.detail === "string" ? body.detail : "GST runtime request failed");
  }
  return body as T;
}

async function mutate<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch("/api/office-runtime/" + path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.detail === "string" ? body.detail : "GST provider action failed");
  }
  return body as T;
}

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(parsed);
}

function monthKey(value: string) {
  return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : "UNKNOWN";
}

function monthLabel(value: string) {
  if (value === "UNKNOWN") return "Unknown period";
  const [year, month] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function totals(rows: Invoice[]): WorkingTotals {
  return rows.reduce<WorkingTotals>(
    (sum, invoice) => ({
      netTaxable: sum.netTaxable + Number(invoice.net_taxable || 0),
      cgst: sum.cgst + Number(invoice.cgst || 0),
      sgst: sum.sgst + Number(invoice.sgst || 0),
      igst: sum.igst + Number(invoice.igst || 0),
      total: sum.total + Number(invoice.total || 0),
      invoiceCount: sum.invoiceCount + 1,
    }),
    { netTaxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, invoiceCount: 0 },
  );
}

export function OfficeGstTaxWorkspace({
  canPrepare,
  canApprove,
}: {
  canPrepare: boolean;
  canApprove: boolean;
}) {
  const [summary, setSummary] = useState<GstSummary>();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [gstMaster, setGstMaster] = useState<GstMaster>();
  const [taxProfiles, setTaxProfiles] = useState<ProductTaxProfile[]>([]);
  const [configuration, setConfiguration] = useState<GstConfiguration>();
  const [connector, setConnector] = useState<GstConnectorStatus>();
  const [einvoices, setEinvoices] = useState<EinvoiceRecord[]>([]);
  const [period, setPeriod] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [cancelDrafts, setCancelDrafts] = useState<Record<string, { reason: string; remarks: string }>>({});
  const [error, setError] = useState<string>();

  const fetchRecords = useCallback((signal?: AbortSignal) => Promise.all([
    runtime<GstSummary>("tax/gst/summary", signal),
    runtime<Invoice[]>("invoices", signal),
    runtime<Customer[]>("customers", signal),
    runtime<Product[]>("products", signal),
    runtime<GstMaster>("tax/gst/master", signal),
    runtime<ProductTaxProfile[]>("tax/gst/product-profiles", signal),
    runtime<GstConfiguration>("tax/gst/configuration", signal),
    runtime<GstConnectorStatus>("tax/gst/connector/status", signal),
    runtime<EinvoiceRecord[]>("tax/gst/einvoice", signal),
  ]), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextSummary, nextInvoices, nextCustomers, nextProducts, nextGstMaster, nextTaxProfiles, nextConfiguration, nextConnector, nextEinvoices] = await fetchRecords();
      setSummary(nextSummary);
      setInvoices(nextInvoices);
      setCustomers(nextCustomers);
      setProducts(nextProducts);
      setGstMaster(nextGstMaster);
      setTaxProfiles(nextTaxProfiles);
      setConfiguration(nextConfiguration);
      setConnector(nextConnector);
      setEinvoices(nextEinvoices);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load GST working records");
    } finally {
      setLoading(false);
    }
  }, [fetchRecords]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetchRecords(controller.signal)
      .then(([nextSummary, nextInvoices, nextCustomers, nextProducts, nextGstMaster, nextTaxProfiles, nextConfiguration, nextConnector, nextEinvoices]) => {
        if (!active) return;
        setSummary(nextSummary);
        setInvoices(nextInvoices);
        setCustomers(nextCustomers);
        setProducts(nextProducts);
        setGstMaster(nextGstMaster);
        setTaxProfiles(nextTaxProfiles);
        setConfiguration(nextConfiguration);
        setConnector(nextConnector);
        setEinvoices(nextEinvoices);
      })
      .catch((caught) => {
        if (active && !(caught instanceof DOMException && caught.name === "AbortError")) {
          setError(caught instanceof Error ? caught.message : "Unable to load GST working records");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [fetchRecords]);

  const periods = useMemo(
    () => Array.from(new Set(invoices.map((invoice) => monthKey(invoice.issued_at)))).sort().reverse(),
    [invoices],
  );
  const visibleInvoices = useMemo(
    () => (period === "ALL" ? invoices : invoices.filter((invoice) => monthKey(invoice.issued_at) === period)),
    [invoices, period],
  );
  const derived = useMemo(() => totals(visibleInvoices), [visibleInvoices]);
  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const einvoiceMap = useMemo(() => new Map(einvoices.map((record) => [record.invoice_id, record])), [einvoices]);

  const providerAction = useCallback(async (
    key: string,
    actionPath: string,
    payload: unknown | undefined,
    success: (result: unknown) => string,
  ) => {
    setActionBusy(key);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await mutate<unknown>(actionPath, payload);
      setNotice(success(result));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "GST provider action failed");
    } finally {
      setActionBusy(undefined);
    }
  }, [load]);

  const working = period === "ALL" && summary
    ? {
        netTaxable: Number(summary.net_taxable || 0),
        cgst: Number(summary.cgst || 0),
        sgst: Number(summary.sgst || 0),
        igst: Number(summary.igst || 0),
        total: Number(summary.total || 0),
        invoiceCount: Number(summary.invoice_count || 0),
      }
    : derived;
  const outputTax = working.cgst + working.sgst + working.igst;

  return <section className={styles.shell}>
    <header className={styles.hero}>
      <div>
        <p>GST & TAX · WORKING REGISTER</p>
        <h2>Review invoice-derived output GST without fabricating filing or input-credit status.</h2>
        <span>
          This workspace combines the canonical GST register with a credential-gated IRIS IRP connector for
          taxpayer verification and e-invoice operations. It does not infer return filing or input-tax credit.
        </span>
      </div>
      <div className={styles.authority} aria-label="GST workspace authority">
        <span data-active={canPrepare}><ShieldCheck /> Prepare {canPrepare ? "assigned" : "not assigned"}</span>
        <span data-active={canApprove}><BadgeCheck /> Review {canApprove ? "assigned" : "not assigned"}</span>
      </div>
    </header>

    <div className={styles.toolbar}>
      <label>
        Working period
        <select value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="ALL">All issued invoices</option>
          {periods.map((item) => <option key={item} value={item}>{monthLabel(item)}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw /> Refresh</button>
      <Link href="/finance/billing"><FileCheck2 /> Open billing evidence</Link>
    </div>

    {notice ? <div className={styles.notice}><BadgeCheck />{notice}</div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}
    {loading ? <div className={styles.state}><LoaderCircle className={styles.spin} />Loading canonical GST working data…</div> : <>
      <div className={styles.metrics}>
        <article><span>Net taxable sales</span><b>{money(working.netTaxable)}</b></article>
        <article><span>Output GST</span><b>{money(outputTax)}</b></article>
        <article><span>CGST</span><b>{money(working.cgst)}</b></article>
        <article><span>SGST</span><b>{money(working.sgst)}</b></article>
        <article><span>IGST</span><b>{money(working.igst)}</b></article>
        <article><span>Gross invoice value</span><b>{money(working.total)}</b></article>
        <article><span>Invoices in view</span><b>{working.invoiceCount}</b></article>
        <article><span>Working state</span><b>{summary?.filing_status || "REVIEW_REQUIRED"}</b></article>
      </div>

      <section className={styles.connectorPanel} aria-label="GST IRP connector">
        <header>
          <div>
            <p>LIVE GST CONNECTOR</p>
            <h3>IRIS IRP core API</h3>
          </div>
          <em data-ready={connector?.ready_for_live_irn}>{connector?.ready_for_live_irn ? "IRN READY" : connector?.core_configured ? "CONNECTED · IRN GATED" : "NOT CONFIGURED"}</em>
        </header>
        <div className={styles.connectorGrid}>
          <article><span>Provider</span><b>{connector?.provider || "IRIS_IRP"}</b><small>{connector?.environment || "—"} environment</small></article>
          <article><span>Core credentials</span><b>{connector?.core_configured ? "Configured" : "Not configured"}</b><small>{connector?.base_host || "No provider host"}</small></article>
          <article><span>e-Invoice switch</span><b>{connector?.einvoice_enabled ? "Enabled" : "Disabled"}</b><small>Eligibility/operations gate</small></article>
          <article><span>Seller INV-01 identity</span><b>{connector?.invoice_identity_configured ? "Configured" : "Incomplete"}</b><small>{connector?.gstin_masked || "GSTIN not configured"}</small></article>
          <article><span>Last GSTIN verification</span><b>{connector?.last_gstin_verification?.registration_status || "No provider evidence"}</b><small>{connector?.last_gstin_verification?.legal_name || "Run verification after credentials are configured"}</small></article>
          <article><span>Last provider operation</span><b>{connector?.last_operation?.status || "None"}</b><small>{connector?.last_operation ? connector.last_operation.operation + " · " + date(connector.last_operation.created_at || "") : "No API operation recorded"}</small></article>
        </div>
        <div className={styles.connectorActions}>
          <button type="button" disabled={!canPrepare || !connector?.core_configured || Boolean(actionBusy)} onClick={() => void providerAction("health", "tax/gst/connector/health", undefined, () => "IRIS IRP health check succeeded.")}>
            {actionBusy === "health" ? <LoaderCircle className={styles.spin} /> : <ShieldCheck />} Test IRP
          </button>
          <button type="button" disabled={!canPrepare || !connector?.core_configured || Boolean(actionBusy)} onClick={() => void providerAction("verify", "tax/gst/connector/verify-gstin", { sync_common_portal: false }, (result) => {
            const row = result as { legal_name?: string; registration_status?: string };
            return "GSTIN verified" + (row.legal_name ? " · " + row.legal_name : "") + (row.registration_status ? " · " + row.registration_status : "") + ".";
          })}>
            {actionBusy === "verify" ? <LoaderCircle className={styles.spin} /> : <BadgeCheck />} Verify GSTIN
          </button>
          <button type="button" disabled={!canPrepare || !connector?.core_configured || Boolean(actionBusy)} onClick={() => void providerAction("sync", "tax/gst/connector/verify-gstin", { sync_common_portal: true }, () => "GSTIN details synchronized from the GST Common Portal through IRIS IRP.")}>
            {actionBusy === "sync" ? <LoaderCircle className={styles.spin} /> : <RefreshCw />} Sync Common Portal
          </button>
        </div>
        {connector?.missing_configuration?.length ? <p className={styles.connectorNote}>Deployment configuration still required: {connector.missing_configuration.join(", ")}. No credential value is exposed or stored in the browser.</p> : <p className={styles.connectorNote}>{connector?.secret_storage || "Provider secrets remain server-side."}</p>}
      </section>

      <section className={styles.configPanel} aria-label="GST production configuration">
        <header>
          <div><p>PRODUCTION TAX CONTROL</p><h3>{configuration?.ready_for_production_invoicing ? "Production invoicing tax gate is ready" : "Production invoicing remains gated"}</h3></div>
          <em data-ready={configuration?.ready_for_production_invoicing}>{configuration?.ready_for_production_invoicing ? "READY" : "REVIEW REQUIRED"}</em>
        </header>
        <div className={styles.configGrid}>
          <article><span>GSTIN configured</span><b>{configuration?.gstin.configured ? configuration.gstin.masked || "Configured" : "Not configured"}</b><small>{configuration?.gstin.structure_valid ? "Structure valid" : "Structure not validated"}</small></article>
          <article><span>Supplier state</span><b>{configuration?.gstin.state_code || "—"}</b><small>{configuration?.gstin.state_matches ? "GSTIN state matches" : "State match pending"}</small></article>
          <article><span>Tax config switch</span><b>{configuration?.tax_config_approved ? "Approved" : "Not approved"}</b><small>Controlled deployment setting</small></article>
          <article><span>Product profiles</span><b>{configuration?.profiles.approved_billing || 0}/{configuration?.profiles.billing_enabled || 0}</b><small>Billing profiles CA-approved</small></article>
          <article><span>GST registration evidence</span><b>{configuration?.portal_verification || "NOT_CONNECTED"}</b><small>{configuration?.authoritative_gstin?.verified_at ? "IRIS · " + date(configuration.authoritative_gstin.verified_at) : "Provider verification required"}</small></article>
        </div>
        <p className={styles.configNote}>{configuration?.note}</p>
      </section>

      <section className={styles.profileRegister} aria-label="Product GST profiles">
        <header>
          <div><p>PRODUCT TAX PROFILES</p><h3>Backend-owned SAC and GST configuration</h3></div>
          <span>Invoice and plan creation must match these controlled profiles.</span>
        </header>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Product</th><th>Supply model</th><th>SAC</th><th>GST</th><th>Billing</th><th>Review state</th><th>Evidence</th></tr></thead>
            <tbody>
              {taxProfiles.map(profile => <tr key={profile.id}>
                <td><strong>{profile.product_code || "—"} · {profile.product_name}</strong><small>{profile.classification_basis}</small></td>
                <td>{profile.supply_model.replaceAll("_"," ")}</td>
                <td><strong>{profile.sac}</strong></td>
                <td>{profile.gst_rate}%</td>
                <td><em data-status={profile.billing_enabled ? "PAID" : "DISABLED"}>{profile.billing_enabled ? "ENABLED" : "DISABLED"}</em></td>
                <td><em data-status={profile.status === "APPROVED" ? "PAID" : profile.status}>{profile.status}</em></td>
                <td>{profile.evidence_ref || "CA evidence required"}</td>
              </tr>)}
              {!taxProfiles.length ? <tr><td colSpan={7}><div className={styles.empty}>No product tax profiles are configured.</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.rateMaster} aria-label="GST rate master">
        <header>
          <div><p>GSTN / IRP RATE MASTER</p><h3>Permitted standard GST percentages</h3></div>
          <span>Verified {gstMaster?.verified_on || "—"} · IT services default {gstMaster?.it_services.default_rate || "18"}%</span>
        </header>
        <div className={styles.rateGrid}>
          {(gstMaster?.standard_rates || []).map((rate) => <span key={rate} data-it-default={rate === gstMaster?.it_services.default_rate}>{rate}%</span>)}
        </div>
        <div className={styles.taxGuidance}>
          <p><b>IT services:</b> {gstMaster?.it_services.classification_note || "CBIC IT-service rate reference is 18%."}</p>
          <p><b>Tax split:</b> intra-state → {gstMaster?.calculation.intra_state || "CGST + SGST"}; inter-state → {gstMaster?.calculation.inter_state || "IGST"}.</p>
          <p><b>0% control:</b> {gstMaster?.calculation.zero_rate_note || "Zero-rate treatment requires separate evidence."}</p>
        </div>
        <details>
          <summary>IT-service SAC reference</summary>
          <div className={styles.sacGrid}>{gstMaster?.it_services.sacs.map((item) => <span key={item.code}><b>{item.code}</b>{item.description}</span>)}</div>
        </details>
      </section>

      <div className={styles.assurance}>
        <article><Database /><div><b>Canonical source</b><span>Issued invoice snapshots and their recorded GST split.</span></div></article>
        <article><ShieldCheck /><div><b>Output GST only</b><span>Input tax credit is not calculated by this source, so no net GST payable is claimed.</span></div></article>
        <article><FileCheck2 /><div><b>Filing evidence</b><span>No GST portal filing is performed or inferred by this workspace. Filing evidence must come from an external authoritative source.</span></div></article>
      </div>

      <section className={styles.register} aria-label="GST invoice register">
        <header>
          <div><p>SALES REGISTER</p><h3>{period === "ALL" ? "All invoice periods" : monthLabel(period)}</h3></div>
          <span>{summary?.note || "Working sales-register summary only."}</span>
        </header>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Product</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th><th>Status</th><th>IRP / IRN</th></tr></thead>
            <tbody>
              {visibleInvoices.map((invoice) => {
                const customer = customerMap.get(invoice.customer_id);
                const product = productMap.get(invoice.product_id);
                const einvoice = einvoiceMap.get(invoice.id);
                const buyerReady = Boolean(customer?.gstin && customer?.billing_address && customer?.billing_locality && customer?.billing_pincode);
                const canGenerate = Boolean(canPrepare && connector?.ready_for_live_irn && buyerReady && (!einvoice || einvoice.status === "FAILED"));
                const cancelDraft = cancelDrafts[invoice.id] || { reason: "1", remarks: "" };
                return <tr key={invoice.id}>
                  <td><strong>{invoice.invoice_no}</strong><small title={invoice.document_hash}>hash {invoice.document_hash?.slice(0, 12) || "—"}</small></td>
                  <td>{date(invoice.issued_at)}</td>
                  <td>{customer?.display_name || customer?.legal_name || invoice.customer_id}<small>{customer?.gstin || "No buyer GSTIN"}</small></td>
                  <td>{product ? `${product.code} · ${product.name}` : invoice.product_id}</td>
                  <td>{money(invoice.net_taxable, invoice.currency)}</td>
                  <td>{money(invoice.cgst, invoice.currency)}</td>
                  <td>{money(invoice.sgst, invoice.currency)}</td>
                  <td>{money(invoice.igst, invoice.currency)}</td>
                  <td>{money(invoice.total, invoice.currency)}</td>
                  <td><em data-status={invoice.status}>{invoice.status}</em></td>
                  <td className={styles.irpCell}>
                    <em data-status={einvoice?.status === "GENERATED" ? "PAID" : einvoice?.status || "NONE"}>{einvoice?.status || "NOT GENERATED"}</em>
                    {einvoice?.irn ? <small title={einvoice.irn}>IRN {einvoice.irn.slice(0, 16)}…</small> : null}
                    {einvoice?.ack_no ? <small>Ack {einvoice.ack_no}</small> : null}
                    {einvoice?.last_error ? <small className={styles.irpError}>{einvoice.last_error}</small> : null}
                    {canGenerate ? <button type="button" disabled={Boolean(actionBusy)} onClick={() => void providerAction(
                      "generate-" + invoice.id,
                      "tax/gst/einvoice/" + encodeURIComponent(invoice.id) + "/generate",
                      undefined,
                      () => "IRN generated for " + invoice.invoice_no + ".",
                    )}>{actionBusy === "generate-" + invoice.id ? <LoaderCircle className={styles.spin} /> : <FileCheck2 />} Generate IRN</button> : null}
                    {!einvoice && connector?.ready_for_live_irn && !buyerReady ? <small>Buyer GSTIN + billing address/locality/pincode required.</small> : null}
                    {einvoice?.status === "GENERATED" && canApprove ? <details className={styles.cancelIrn}>
                      <summary>Cancel IRN</summary>
                      <label>Reason<select value={cancelDraft.reason} onChange={(event) => setCancelDrafts((current) => ({ ...current, [invoice.id]: { ...cancelDraft, reason: event.target.value } }))}>
                        <option value="1">Duplicate</option>
                        <option value="2">Data entry mistake</option>
                        <option value="3">Order cancelled</option>
                        <option value="4">Other</option>
                      </select></label>
                      <label>Remarks<input maxLength={100} value={cancelDraft.remarks} onChange={(event) => setCancelDrafts((current) => ({ ...current, [invoice.id]: { ...cancelDraft, remarks: event.target.value } }))} /></label>
                      <button type="button" disabled={cancelDraft.remarks.trim().length < 3 || Boolean(actionBusy)} onClick={() => void providerAction(
                        "cancel-" + invoice.id,
                        "tax/gst/einvoice/" + encodeURIComponent(invoice.id) + "/cancel",
                        { reason_code: cancelDraft.reason, remarks: cancelDraft.remarks.trim() },
                        () => "IRN cancelled for " + invoice.invoice_no + ".",
                      )}>{actionBusy === "cancel-" + invoice.id ? <LoaderCircle className={styles.spin} /> : <CircleAlert />} Confirm cancellation</button>
                    </details> : null}
                  </td>
                </tr>;
              })}
              {!visibleInvoices.length ? <tr><td colSpan={11}><div className={styles.empty}>No canonical invoices exist for this working period.</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>}
  </section>;
}
