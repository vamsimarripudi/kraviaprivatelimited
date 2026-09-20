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
  note: string;
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
  const [period, setPeriod] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const fetchRecords = useCallback((signal?: AbortSignal) => Promise.all([
    runtime<GstSummary>("tax/gst/summary", signal),
    runtime<Invoice[]>("invoices", signal),
    runtime<Customer[]>("customers", signal),
    runtime<Product[]>("products", signal),
    runtime<GstMaster>("tax/gst/master", signal),
    runtime<ProductTaxProfile[]>("tax/gst/product-profiles", signal),
    runtime<GstConfiguration>("tax/gst/configuration", signal),
  ]), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextSummary, nextInvoices, nextCustomers, nextProducts, nextGstMaster, nextTaxProfiles, nextConfiguration] = await fetchRecords();
      setSummary(nextSummary);
      setInvoices(nextInvoices);
      setCustomers(nextCustomers);
      setProducts(nextProducts);
      setGstMaster(nextGstMaster);
      setTaxProfiles(nextTaxProfiles);
      setConfiguration(nextConfiguration);
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
      .then(([nextSummary, nextInvoices, nextCustomers, nextProducts, nextGstMaster, nextTaxProfiles, nextConfiguration]) => {
        if (!active) return;
        setSummary(nextSummary);
        setInvoices(nextInvoices);
        setCustomers(nextCustomers);
        setProducts(nextProducts);
        setGstMaster(nextGstMaster);
        setTaxProfiles(nextTaxProfiles);
        setConfiguration(nextConfiguration);
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
          This workspace is a controlled working register. It does not file returns, calculate input-tax credit,
          or assert statutory compliance without external filing evidence and professional review.
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
          <article><span>GST portal evidence</span><b>{configuration?.portal_verification || "NOT_CONNECTED"}</b><small>Portal status is never inferred</small></article>
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
            <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Product</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {visibleInvoices.map((invoice) => {
                const customer = customerMap.get(invoice.customer_id);
                const product = productMap.get(invoice.product_id);
                return <tr key={invoice.id}>
                  <td><strong>{invoice.invoice_no}</strong><small title={invoice.document_hash}>hash {invoice.document_hash?.slice(0, 12) || "—"}</small></td>
                  <td>{date(invoice.issued_at)}</td>
                  <td>{customer?.display_name || customer?.legal_name || invoice.customer_id}</td>
                  <td>{product ? `${product.code} · ${product.name}` : invoice.product_id}</td>
                  <td>{money(invoice.net_taxable, invoice.currency)}</td>
                  <td>{money(invoice.cgst, invoice.currency)}</td>
                  <td>{money(invoice.sgst, invoice.currency)}</td>
                  <td>{money(invoice.igst, invoice.currency)}</td>
                  <td>{money(invoice.total, invoice.currency)}</td>
                  <td><em data-status={invoice.status}>{invoice.status}</em></td>
                </tr>;
              })}
              {!visibleInvoices.length ? <tr><td colSpan={10}><div className={styles.empty}>No canonical invoices exist for this working period.</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>}
  </section>;
}
