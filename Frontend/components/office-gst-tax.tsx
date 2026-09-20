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

type GstVasStatus = {
  provider: string;
  data_api_configured: boolean;
  missing_configuration: string[];
  recipient_download_path: string;
  download_status_path: string;
  consent_required: boolean;
  auth_model: string;
  gsp: {
    provider?: string | null;
    configured: boolean;
    filing_enabled: boolean;
    note: string;
  };
};

type GstPurchaseSummary = {
  invoice_count: number;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  cess: string;
  total: string;
  unmatched: number;
  itc_review_required: number;
  note: string;
};

type GstPurchaseInvoice = {
  id: string;
  supplier_gstin: string;
  supplier_name?: string | null;
  document_type: string;
  document_no: string;
  document_date: string;
  total: string;
  reconciliation_status: string;
  itc_review_status: string;
};

type GstReturnWorking = {
  id: string;
  form_type: string;
  period: string;
  status: string;
  source_hash: string;
  summary: Record<string, unknown>;
  reviewed_by?: string | null;
  filing_provider?: string | null;
  filing_arn?: string | null;
  gsp_submission_ref?: string | null;
  gsp_verified_status?: string | null;
  gsp_verified_at?: string | null;
  itc_review?: {
    igst: string;
    cgst: string;
    sgst: string;
    cess: string;
    evidence_ref: string;
    note: string;
  } | null;
  itc_reviewed_by?: string | null;
  itc_reviewed_at?: string | null;
};

type GstGspStatus = {
  provider: string;
  provider_name: string;
  api_version: string;
  environment: string;
  configured: boolean;
  missing_configuration: string[];
  taxpayer_authenticated: boolean;
  filing_contract?: string | null;
  filing_contract_ready: boolean;
  capabilities: {
    taxpayer_otp_auth: boolean;
    gstr1_save: boolean;
    gstr1_submit: boolean;
    gstr1_evc_file: boolean;
    gstr3b_save: boolean;
    gstr3b_evc_file: boolean;
    gstr2b: boolean;
    ledgers: boolean;
    return_status: boolean;
  };
  secret_storage: string;
};

type WorkingTotals = {
  netTaxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  invoiceCount: number;
};

type ViewKey = "overview" | "sales" | "purchases" | "returns" | "settings";

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

function gstText(invoice: Invoice) {
  if (Number(invoice.igst || 0) > 0) return "IGST " + money(invoice.igst, invoice.currency);
  return "CGST " + money(invoice.cgst, invoice.currency) + " · SGST " + money(invoice.sgst, invoice.currency);
}

export function OfficeGstTaxWorkspace({
  canPrepare,
  canApprove,
  canSignatory,
}: {
  canPrepare: boolean;
  canApprove: boolean;
  canSignatory: boolean;
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
  const [vasStatus, setVasStatus] = useState<GstVasStatus>();
  const [purchaseSummary, setPurchaseSummary] = useState<GstPurchaseSummary>();
  const [purchaseInvoices, setPurchaseInvoices] = useState<GstPurchaseInvoice[]>([]);
  const [returnWorkings, setReturnWorkings] = useState<GstReturnWorking[]>([]);
  const [gspStatus, setGspStatus] = useState<GstGspStatus>();
  const [gspOtpRequested, setGspOtpRequested] = useState(false);
  const [gspOtp, setGspOtp] = useState("");
  const [evcDrafts, setEvcDrafts] = useState<Record<string, { pan: string; otp: string }>>({});
  const [itcDrafts, setItcDrafts] = useState<Record<string, { igst: string; cgst: string; sgst: string; cess: string; evidence: string; note: string }>>({});
  const [view, setView] = useState<ViewKey>("overview");
  const [returnPeriod, setReturnPeriod] = useState(() => new Date().toISOString().slice(0, 7));
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
    runtime<GstVasStatus>("tax/gst/vas/status", signal),
    runtime<GstPurchaseSummary>("tax/gst/purchases/summary", signal),
    runtime<GstPurchaseInvoice[]>("tax/gst/purchases?limit=20", signal),
    runtime<GstReturnWorking[]>("tax/gst/returns", signal),
    runtime<GstGspStatus>("tax/gst/gsp/status", signal),
  ]), []);

  const applyRecords = useCallback((records: Awaited<ReturnType<typeof fetchRecords>>) => {
    const [
      nextSummary,
      nextInvoices,
      nextCustomers,
      nextProducts,
      nextGstMaster,
      nextTaxProfiles,
      nextConfiguration,
      nextConnector,
      nextEinvoices,
      nextVasStatus,
      nextPurchaseSummary,
      nextPurchaseInvoices,
      nextReturnWorkings,
      nextGspStatus,
    ] = records;
    setSummary(nextSummary);
    setInvoices(nextInvoices);
    setCustomers(nextCustomers);
    setProducts(nextProducts);
    setGstMaster(nextGstMaster);
    setTaxProfiles(nextTaxProfiles);
    setConfiguration(nextConfiguration);
    setConnector(nextConnector);
    setEinvoices(nextEinvoices);
    setVasStatus(nextVasStatus);
    setPurchaseSummary(nextPurchaseSummary);
    setPurchaseInvoices(nextPurchaseInvoices);
    setReturnWorkings(nextReturnWorkings);
    setGspStatus(nextGspStatus);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      applyRecords(await fetchRecords());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load GST working records");
    } finally {
      setLoading(false);
    }
  }, [applyRecords, fetchRecords]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetchRecords(controller.signal)
      .then((records) => {
        if (active) applyRecords(records);
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
  }, [applyRecords, fetchRecords]);

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
  const observedInputTax = Number(purchaseSummary?.cgst || 0) + Number(purchaseSummary?.sgst || 0) + Number(purchaseSummary?.igst || 0) + Number(purchaseSummary?.cess || 0);
  const registrationActive = (configuration?.authoritative_gstin?.registration_status || "").toUpperCase() === "ACTIVE"
    || (configuration?.authoritative_gstin?.registration_status || "").toUpperCase() === "ACT";
  const reviewQueue = Number(purchaseSummary?.itc_review_required || 0) + Number(configuration?.profiles.pending_billing || 0);

  const views: { key: ViewKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "sales", label: "Sales", count: working.invoiceCount },
    { key: "purchases", label: "Purchases", count: purchaseSummary?.invoice_count || 0 },
    { key: "returns", label: "Returns", count: returnWorkings.length },
    { key: "settings", label: "Settings" },
  ];

  return <section className={styles.shell}>
    <header className={styles.topbar}>
      <div className={styles.titleBlock}>
        <p>FINANCE / GST</p>
        <h2>GST Control Center</h2>
        <span>Sales tax, e-invoice, inward reconciliation and return preparation in one controlled workspace.</span>
      </div>
      <div className={styles.topActions}>
        <span className={styles.readiness} data-ready={configuration?.ready_for_production_invoicing}>
          {configuration?.ready_for_production_invoicing ? <BadgeCheck /> : <CircleAlert />}
          {configuration?.ready_for_production_invoicing ? "Production ready" : "Action required"}
        </span>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? styles.spin : undefined} /> Refresh
        </button>
        <Link href="/finance/billing"><FileCheck2 /> Billing</Link>
      </div>
    </header>

    <nav className={styles.tabs} aria-label="GST workspace views">
      {views.map((item) => <button
        key={item.key}
        type="button"
        aria-current={view === item.key ? "page" : undefined}
        data-active={view === item.key}
        onClick={() => setView(item.key)}
      >
        {item.label}
        {typeof item.count === "number" ? <span>{item.count}</span> : null}
      </button>)}
    </nav>

    {notice ? <div className={styles.notice}><BadgeCheck />{notice}</div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}

    {loading ? <div className={styles.loading}><LoaderCircle className={styles.spin} />Loading GST workspace…</div> : <>
      {view === "overview" ? <div className={styles.viewStack}>
        <section className={styles.kpiGrid} aria-label="GST summary">
          <article><span>Taxable sales</span><b>{money(working.netTaxable)}</b><small>{working.invoiceCount} invoices</small></article>
          <article><span>Output GST</span><b>{money(outputTax)}</b><small>CGST + SGST + IGST</small></article>
          <article><span>Observed inward GST</span><b>{money(observedInputTax)}</b><small>Not an ITC claim</small></article>
          <article><span>Review queue</span><b>{reviewQueue}</b><small>Tax/profile checks pending</small></article>
        </section>

        <section className={styles.statusCard}>
          <div className={styles.sectionTitle}>
            <div><p>LIVE STATUS</p><h3>What needs attention now</h3></div>
            <span>Technical details are kept under Settings.</span>
          </div>
          <div className={styles.statusRows}>
            <article>
              <div><b>GST registration</b><small>{configuration?.authoritative_gstin?.legal_name || "Authoritative verification pending"}</small></div>
              <em data-state={registrationActive ? "ok" : "warn"}>{registrationActive ? "ACTIVE" : "VERIFY"}</em>
            </article>
            <article>
              <div><b>e-Invoice / IRP</b><small>{connector?.ready_for_live_irn ? "IRN operations available" : connector?.core_configured ? "Connected but gated" : "Provider credentials not configured"}</small></div>
              <em data-state={connector?.ready_for_live_irn ? "ok" : "warn"}>{connector?.ready_for_live_irn ? "READY" : "GATED"}</em>
            </article>
            <article>
              <div><b>Purchase data</b><small>{vasStatus?.data_api_configured ? "IRIS inward-data connector ready" : "VAS/Data API credentials not configured"}</small></div>
              <em data-state={vasStatus?.data_api_configured ? "ok" : "warn"}>{vasStatus?.data_api_configured ? "READY" : "SETUP"}</em>
            </article>
            <article>
              <div><b>GST returns</b><small>{gspStatus?.taxpayer_authenticated ? "FYN Gateway taxpayer session connected" : gspStatus?.configured ? "FYN Gateway configured; GST OTP connection required" : "Preparation only; FYN Gateway not configured"}</small></div>
              <em data-state={gspStatus?.taxpayer_authenticated ? "ok" : gspStatus?.configured ? "warn" : "neutral"}>{gspStatus?.taxpayer_authenticated ? "CONNECTED" : gspStatus?.configured ? "OTP REQUIRED" : "PREP ONLY"}</em>
            </article>
          </div>
        </section>

        <section className={styles.actionCard}>
          <div className={styles.sectionTitle}>
            <div><p>QUICK ACTIONS</p><h3>Common GST operations</h3></div>
          </div>
          <div className={styles.actionGrid}>
            <button type="button" disabled={!canPrepare || !connector?.core_configured || Boolean(actionBusy)} onClick={() => void providerAction("verify", "tax/gst/connector/verify-gstin", { sync_common_portal: false }, (result) => {
              const row = result as { legal_name?: string; registration_status?: string };
              return "GSTIN verified" + (row.legal_name ? " · " + row.legal_name : "") + (row.registration_status ? " · " + row.registration_status : "") + ".";
            })}>
              {actionBusy === "verify" ? <LoaderCircle className={styles.spin} /> : <BadgeCheck />}
              <span><b>Verify GSTIN</b><small>Check current taxpayer evidence</small></span>
            </button>
            <button type="button" disabled={!canPrepare || !connector?.core_configured || Boolean(actionBusy)} onClick={() => void providerAction("sync", "tax/gst/connector/verify-gstin", { sync_common_portal: true }, () => "GSTIN details synchronized from the GST Common Portal through IRIS IRP.")}>
              {actionBusy === "sync" ? <LoaderCircle className={styles.spin} /> : <RefreshCw />}
              <span><b>Sync Common Portal</b><small>Refresh GSTIN details through IRIS</small></span>
            </button>
            <button type="button" disabled={!canPrepare || Boolean(actionBusy)} onClick={() => void providerAction("reconcile-purchases", "tax/gst/purchases/reconcile", undefined, (result) => {
              const row = result as { count?: number };
              return "Purchase reconciliation completed for " + (row.count ?? 0) + " inward invoices.";
            })}>
              {actionBusy === "reconcile-purchases" ? <LoaderCircle className={styles.spin} /> : <Database />}
              <span><b>Reconcile purchases</b><small>Match suppliers and bank debits</small></span>
            </button>
          </div>
        </section>
      </div> : null}

      {view === "sales" ? <div className={styles.viewStack}>
        <section className={styles.sectionCard}>
          <div className={styles.sectionTitle}>
            <div><p>SALES REGISTER</p><h3>Issued invoices and e-invoice state</h3></div>
            <label className={styles.periodControl}>Period<select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="ALL">All issued invoices</option>
              {periods.map((item) => <option key={item} value={item}>{monthLabel(item)}</option>)}
            </select></label>
          </div>
          <div className={styles.miniMetrics}>
            <span><small>Taxable</small><b>{money(working.netTaxable)}</b></span>
            <span><small>Output GST</small><b>{money(outputTax)}</b></span>
            <span><small>Total</small><b>{money(working.total)}</b></span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.salesTable}>
              <thead><tr><th>Invoice</th><th>Customer</th><th>Product</th><th>Taxable</th><th>GST</th><th>Total</th><th>IRN</th></tr></thead>
              <tbody>
                {visibleInvoices.map((invoice) => {
                  const customer = customerMap.get(invoice.customer_id);
                  const product = productMap.get(invoice.product_id);
                  const einvoice = einvoiceMap.get(invoice.id);
                  const buyerReady = Boolean(customer?.gstin && customer?.billing_address && customer?.billing_locality && customer?.billing_pincode);
                  const canGenerate = Boolean(canPrepare && connector?.ready_for_live_irn && buyerReady && (!einvoice || einvoice.status === "FAILED"));
                  const cancelDraft = cancelDrafts[invoice.id] || { reason: "1", remarks: "" };
                  return <tr key={invoice.id}>
                    <td><strong>{invoice.invoice_no}</strong><small>{date(invoice.issued_at)}</small></td>
                    <td><strong>{customer?.display_name || customer?.legal_name || invoice.customer_id}</strong><small>{customer?.gstin || "No buyer GSTIN"}</small></td>
                    <td>{product ? product.code + " · " + product.name : invoice.product_id}</td>
                    <td>{money(invoice.net_taxable, invoice.currency)}</td>
                    <td><strong>{money(Number(invoice.cgst || 0) + Number(invoice.sgst || 0) + Number(invoice.igst || 0), invoice.currency)}</strong><small>{gstText(invoice)}</small></td>
                    <td><strong>{money(invoice.total, invoice.currency)}</strong><small>{invoice.status}</small></td>
                    <td className={styles.irnCell}>
                      <em data-state={einvoice?.status === "GENERATED" ? "ok" : einvoice?.status === "FAILED" ? "error" : "neutral"}>{einvoice?.status || "NOT GENERATED"}</em>
                      {einvoice?.irn ? <small title={einvoice.irn}>IRN {einvoice.irn.slice(0, 14)}…</small> : null}
                      {einvoice?.ack_no ? <small>Ack {einvoice.ack_no}</small> : null}
                      {canGenerate ? <button type="button" disabled={Boolean(actionBusy)} onClick={() => void providerAction(
                        "generate-" + invoice.id,
                        "tax/gst/einvoice/" + encodeURIComponent(invoice.id) + "/generate",
                        undefined,
                        () => "IRN generated for " + invoice.invoice_no + ".",
                      )}>{actionBusy === "generate-" + invoice.id ? <LoaderCircle className={styles.spin} /> : <FileCheck2 />} Generate</button> : null}
                      {!einvoice && connector?.ready_for_live_irn && !buyerReady ? <small>Buyer GSTIN + address required.</small> : null}
                      {einvoice?.last_error ? <small className={styles.inlineError}>{einvoice.last_error}</small> : null}
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
                {!visibleInvoices.length ? <tr><td colSpan={7}><div className={styles.empty}>No issued invoices in this period.</div></td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div> : null}

      {view === "purchases" ? <div className={styles.viewStack}>
        <section className={styles.sectionCard}>
          <div className={styles.sectionTitle}>
            <div><p>PURCHASES</p><h3>Inward GST evidence and book matching</h3></div>
            <button className={styles.primaryAction} type="button" disabled={!canPrepare || Boolean(actionBusy)} onClick={() => void providerAction("reconcile-purchases", "tax/gst/purchases/reconcile", undefined, (result) => {
              const row = result as { count?: number };
              return "Purchase reconciliation completed for " + (row.count ?? 0) + " inward invoices.";
            })}>{actionBusy === "reconcile-purchases" ? <LoaderCircle className={styles.spin} /> : <RefreshCw />} Reconcile</button>
          </div>
          <div className={styles.kpiGridCompact}>
            <article><span>Imported</span><b>{purchaseSummary?.invoice_count || 0}</b></article>
            <article><span>Observed GST</span><b>{money(observedInputTax)}</b></article>
            <article><span>Unmatched</span><b>{purchaseSummary?.unmatched || 0}</b></article>
            <article><span>ITC review</span><b>{purchaseSummary?.itc_review_required || 0}</b></article>
          </div>
          <p className={styles.helper}>{purchaseSummary?.note || "Imported inward GST is observational. No ITC eligibility or claim is inferred."}</p>
          <div className={styles.tableWrap}>
            <table className={styles.purchaseTable}>
              <thead><tr><th>Supplier</th><th>Document</th><th>Date</th><th>Total</th><th>Books match</th><th>ITC review</th></tr></thead>
              <tbody>
                {purchaseInvoices.map((invoice) => <tr key={invoice.id}>
                  <td><strong>{invoice.supplier_name || invoice.supplier_gstin}</strong><small>{invoice.supplier_gstin}</small></td>
                  <td><strong>{invoice.document_no}</strong><small>{invoice.document_type}</small></td>
                  <td>{date(invoice.document_date)}</td>
                  <td>{money(Number(invoice.total || 0))}</td>
                  <td><em data-state={invoice.reconciliation_status === "BANK_MATCHED" ? "ok" : "warn"}>{invoice.reconciliation_status}</em></td>
                  <td><em data-state="warn">{invoice.itc_review_status}</em></td>
                </tr>)}
                {!purchaseInvoices.length ? <tr><td colSpan={6}><div className={styles.empty}>No inward e-invoice evidence has been imported yet.</div></td></tr> : null}
              </tbody>
            </table>
          </div>
          <details className={styles.inlineDetails}>
            <summary>Purchase-data connector details</summary>
            <div className={styles.detailGrid}>
              <span><b>IRIS VAS</b><small>{vasStatus?.data_api_configured ? "Configured" : "Not configured"}</small></span>
              <span><b>Consent</b><small>{vasStatus?.consent_required ? "Supplier + recipient consent required" : "—"}</small></span>
              <span><b>Authentication</b><small>{vasStatus?.auth_model || "—"}</small></span>
            </div>
            {vasStatus?.missing_configuration?.length ? <p className={styles.helper}>Missing: {vasStatus.missing_configuration.join(", ")}</p> : null}
          </details>
        </section>
      </div> : null}

      {view === "returns" ? <div className={styles.viewStack}>
        <section className={styles.sectionCard}>
          <div className={styles.sectionTitle}>
            <div><p>RETURNS</p><h3>Prepare, review and file through FYN Gateway</h3></div>
            <span className={styles.mutedStatus}>{gspStatus?.taxpayer_authenticated ? "GST session connected" : gspStatus?.configured ? "OTP connection required" : "GSP setup required"}</span>
          </div>
          <div className={styles.gspConnection}>
            <div>
              <b>FYN Gateway · GSTN GSP</b>
              <small>{gspStatus?.configured ? (gspStatus.taxpayer_authenticated ? "Taxpayer session authenticated. PAN/OTP/session secrets are never stored." : "Provider configured. Connect the GST taxpayer session with OTP.") : "Provider credentials are not configured in the backend environment."}</small>
            </div>
            <div className={styles.gspConnectActions}>
              {!gspStatus?.taxpayer_authenticated ? <button type="button" disabled={!canPrepare || !gspStatus?.configured || Boolean(actionBusy)} onClick={() => void providerAction(
                "gsp-request-otp",
                "tax/gst/gsp/taxpayer/request-otp",
                undefined,
                () => {
                  setGspOtpRequested(true);
                  return "GST taxpayer OTP sent to the registered channel.";
                },
              )}>{actionBusy === "gsp-request-otp" ? <LoaderCircle className={styles.spin} /> : <ShieldCheck />} Request GST OTP</button> : <span className={styles.sessionOk}><BadgeCheck /> Connected</span>}
              {gspOtpRequested && !gspStatus?.taxpayer_authenticated ? <>
                <input aria-label="GST taxpayer OTP" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter GST OTP" value={gspOtp} onChange={(event) => setGspOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} />
                <button type="button" disabled={gspOtp.length < 4 || Boolean(actionBusy)} onClick={() => void providerAction(
                  "gsp-auth",
                  "tax/gst/gsp/taxpayer/auth",
                  { otp: gspOtp },
                  () => {
                    setGspOtp("");
                    setGspOtpRequested(false);
                    return "GST taxpayer session connected through FYN Gateway.";
                  },
                )}>{actionBusy === "gsp-auth" ? <LoaderCircle className={styles.spin} /> : <BadgeCheck />} Connect</button>
              </> : null}
            </div>
          </div>
          <div className={styles.returnActions}>
            <label>Tax period<input type="month" value={returnPeriod} onChange={(event) => setReturnPeriod(event.target.value)} /></label>
            <button type="button" disabled={!canPrepare || !returnPeriod || Boolean(actionBusy)} onClick={() => void providerAction("build-gstr1", "tax/gst/returns/build", { form_type: "GSTR1", period: returnPeriod }, () => "GSTR-1 working rebuilt from canonical sales.")}>{actionBusy === "build-gstr1" ? <LoaderCircle className={styles.spin} /> : <FileCheck2 />} Build GSTR-1</button>
            <button type="button" disabled={!canPrepare || !returnPeriod || Boolean(actionBusy)} onClick={() => void providerAction("build-gstr3b", "tax/gst/returns/build", { form_type: "GSTR3B", period: returnPeriod }, () => "GSTR-3B working rebuilt. Inward GST remains observational pending ITC review.")}>{actionBusy === "build-gstr3b" ? <LoaderCircle className={styles.spin} /> : <FileCheck2 />} Build GSTR-3B</button>
          </div>
          <p className={styles.helper}>Routine filing stays inside Kravia Office: CA review → GSP save/submit → authorized-signatory EVC → ARN verification. GST Portal passwords are never stored.</p>
          <div className={styles.tableWrap}>
            <table className={styles.returnTable}>
              <thead><tr><th>Form</th><th>Period</th><th>Status</th><th>CA / ITC review</th><th>Provider / ARN</th><th>Actions</th></tr></thead>
              <tbody>
                {returnWorkings.map((workingRow) => {
                  const evc = evcDrafts[workingRow.id] || { pan: "", otp: "" };
                  const itc = itcDrafts[workingRow.id] || { igst: "0", cgst: "0", sgst: "0", cess: "0", evidence: "", note: "" };
                  const verified = workingRow.status === "FILED_VERIFIED";
                  return <tr key={workingRow.id}>
                    <td><strong>{workingRow.form_type}</strong><small title={workingRow.source_hash}>source {workingRow.source_hash.slice(0, 12)}…</small></td>
                    <td>{workingRow.period}</td>
                    <td><em data-state={verified ? "ok" : workingRow.status === "REVIEW_REJECTED" ? "error" : workingRow.status === "APPROVED_FOR_FILING" || workingRow.status.startsWith("GSP_") || workingRow.status === "EVC_REQUESTED" ? "warn" : "neutral"}>{workingRow.status}</em>{workingRow.gsp_verified_status ? <small>GSTN/GSP: {workingRow.gsp_verified_status}</small> : null}</td>
                    <td>
                      <strong>{workingRow.reviewed_by || "CA review pending"}</strong>
                      {workingRow.form_type === "GSTR3B" ? <small>{workingRow.itc_reviewed_by ? "ITC reviewed by " + workingRow.itc_reviewed_by : "ITC review required before approval"}</small> : <small>Outward-supply working</small>}
                    </td>
                    <td><strong>{workingRow.filing_provider || "—"}</strong><small>{workingRow.filing_arn ? "ARN " + workingRow.filing_arn : workingRow.gsp_submission_ref ? "Ref " + workingRow.gsp_submission_ref : "No filing reference yet"}</small></td>
                    <td className={styles.returnFlowCell}>
                      {workingRow.form_type === "GSTR3B" && !workingRow.itc_reviewed_at && canApprove ? <details>
                        <summary>Review ITC</summary>
                        <div className={styles.itcGrid}>
                          {(["igst","cgst","sgst","cess"] as const).map((field) => <label key={field}>{field.toUpperCase()}<input inputMode="decimal" value={itc[field]} onChange={(event) => setItcDrafts((current) => ({ ...current, [workingRow.id]: { ...itc, [field]: event.target.value } }))} /></label>)}
                          <label className={styles.wideField}>Evidence reference<input value={itc.evidence} onChange={(event) => setItcDrafts((current) => ({ ...current, [workingRow.id]: { ...itc, evidence: event.target.value } }))} /></label>
                          <label className={styles.wideField}>CA note<input value={itc.note} onChange={(event) => setItcDrafts((current) => ({ ...current, [workingRow.id]: { ...itc, note: event.target.value } }))} /></label>
                        </div>
                        <button type="button" disabled={!itc.evidence.trim() || itc.note.trim().length < 3 || Boolean(actionBusy)} onClick={() => void providerAction(
                          "itc-" + workingRow.id,
                          "tax/gst/gsp/returns/" + encodeURIComponent(workingRow.id) + "/itc-review",
                          { igst: itc.igst || "0", cgst: itc.cgst || "0", sgst: itc.sgst || "0", cess: itc.cess || "0", evidence_ref: itc.evidence.trim(), note: itc.note.trim() },
                          () => "CA ITC review recorded for " + workingRow.period + ".",
                        )}>{actionBusy === "itc-" + workingRow.id ? <LoaderCircle className={styles.spin} /> : <BadgeCheck />} Record ITC review</button>
                      </details> : null}

                      {(workingRow.status === "DRAFT" || workingRow.status === "REVIEW_REJECTED") && canApprove ? <button type="button" disabled={workingRow.form_type === "GSTR3B" && !workingRow.itc_reviewed_at || Boolean(actionBusy)} onClick={() => void providerAction(
                        "approve-" + workingRow.id,
                        "tax/gst/returns/" + encodeURIComponent(workingRow.id) + "/review",
                        { decision: "APPROVE", note: "Reviewed in Kravia Office and approved for GST filing." },
                        () => workingRow.form_type + " approved for filing.",
                      )}><BadgeCheck /> CA approve</button> : null}

                      {workingRow.status === "APPROVED_FOR_FILING" ? <button type="button" disabled={!gspStatus?.taxpayer_authenticated || Boolean(actionBusy)} onClick={() => void providerAction(
                        "save-" + workingRow.id,
                        "tax/gst/gsp/returns/" + encodeURIComponent(workingRow.id) + "/save",
                        undefined,
                        () => workingRow.form_type + " saved through FYN Gateway.",
                      )}><FileCheck2 /> Save to GSTN</button> : null}

                      {workingRow.status === "GSP_SAVED" && workingRow.form_type === "GSTR1" ? <button type="button" disabled={!gspStatus?.taxpayer_authenticated || Boolean(actionBusy)} onClick={() => void providerAction(
                        "submit-" + workingRow.id,
                        "tax/gst/gsp/returns/" + encodeURIComponent(workingRow.id) + "/submit",
                        undefined,
                        () => "GSTR-1 submitted and ready for authorized-signatory EVC.",
                      )}><FileCheck2 /> Submit</button> : null}

                      {canSignatory && (workingRow.status === "GSP_SUBMITTED" || (workingRow.status === "GSP_SAVED" && workingRow.form_type === "GSTR3B")) ? <details>
                        <summary>Authorized signatory</summary>
                        <label>PAN<input autoCapitalize="characters" maxLength={10} placeholder="ABCDE1234F" value={evc.pan} onChange={(event) => setEvcDrafts((current) => ({ ...current, [workingRow.id]: { ...evc, pan: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) } }))} /></label>
                        <button type="button" disabled={!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(evc.pan) || Boolean(actionBusy)} onClick={() => void providerAction(
                          "evc-request-" + workingRow.id,
                          "tax/gst/gsp/returns/" + encodeURIComponent(workingRow.id) + "/evc/request",
                          { pan: evc.pan },
                          () => "EVC OTP sent to the GST authorized signatory.",
                        )}><ShieldCheck /> Send EVC OTP</button>
                      </details> : null}

                      {workingRow.status === "EVC_REQUESTED" && canSignatory ? <div className={styles.evcInline}>
                        <input aria-label={"Authorized signatory PAN for " + workingRow.form_type} autoCapitalize="characters" maxLength={10} placeholder="PAN" value={evc.pan} onChange={(event) => setEvcDrafts((current) => ({ ...current, [workingRow.id]: { ...evc, pan: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) } }))} />
                        <input aria-label={"EVC OTP for " + workingRow.form_type} inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="EVC OTP" value={evc.otp} onChange={(event) => setEvcDrafts((current) => ({ ...current, [workingRow.id]: { ...evc, otp: event.target.value.replace(/\D/g, "").slice(0, 8) } }))} />
                        <button type="button" disabled={!gspStatus?.filing_contract_ready || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(evc.pan) || evc.otp.length < 4 || Boolean(actionBusy)} onClick={() => void providerAction(
                          "file-" + workingRow.id,
                          "tax/gst/gsp/returns/" + encodeURIComponent(workingRow.id) + "/file",
                          { pan: evc.pan, otp: evc.otp },
                          () => {
                            setEvcDrafts((current) => ({ ...current, [workingRow.id]: { pan: "", otp: "" } }));
                            return "GST filing request sent. Verify provider status for ARN.";
                          },
                        )}><BadgeCheck /> File with EVC</button>
                        {!gspStatus?.filing_contract_ready ? <small>Final filing unlocks after FYN sandbox contract acceptance.</small> : null}
                      </div> : null}

                      {(workingRow.status === "GSP_FILE_REQUESTED" || workingRow.gsp_submission_ref) && !verified ? <button type="button" disabled={!gspStatus?.taxpayer_authenticated || Boolean(actionBusy)} onClick={() => void providerAction(
                        "verify-return-" + workingRow.id,
                        "tax/gst/gsp/returns/" + encodeURIComponent(workingRow.id) + "/verify",
                        undefined,
                        () => "Return status refreshed from FYN Gateway/GSTN.",
                      )}><RefreshCw /> Verify filing</button> : null}

                      {verified ? <span className={styles.verifiedFiled}><BadgeCheck /> ARN verified</span> : null}
                    </td>
                  </tr>;
                })}
                {!returnWorkings.length ? <tr><td colSpan={6}><div className={styles.empty}>No GST return working has been built yet.</div></td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div> : null}

      {view === "settings" ? <div className={styles.viewStack}>
        <section className={styles.settingsIntro}>
          <div><p>ADVANCED CONFIGURATION</p><h3>Tax setup and provider diagnostics</h3></div>
          <span>These controls are intentionally separated from day-to-day GST work.</span>
        </section>

        <details className={styles.settingsBlock} open>
          <summary><span>Production tax control</span><em data-state={configuration?.ready_for_production_invoicing ? "ok" : "warn"}>{configuration?.ready_for_production_invoicing ? "READY" : "REVIEW REQUIRED"}</em></summary>
          <div className={styles.detailGrid}>
            <span><b>GSTIN</b><small>{configuration?.gstin.configured ? configuration.gstin.masked || "Configured" : "Not configured"}</small></span>
            <span><b>Registration evidence</b><small>{configuration?.portal_verification || "NOT_CONNECTED"}</small></span>
            <span><b>Supplier state</b><small>{configuration?.gstin.state_code || "—"}</small></span>
            <span><b>Tax config</b><small>{configuration?.tax_config_approved ? "Approved" : "Not approved"}</small></span>
            <span><b>Product profiles</b><small>{configuration?.profiles.approved_billing || 0}/{configuration?.profiles.billing_enabled || 0} approved</small></span>
          </div>
          <p className={styles.helper}>{configuration?.note}</p>
        </details>

        <details className={styles.settingsBlock}>
          <summary><span>FYN Gateway · GST return filing</span><em data-state={gspStatus?.taxpayer_authenticated ? "ok" : gspStatus?.configured ? "warn" : "neutral"}>{gspStatus?.taxpayer_authenticated ? "CONNECTED" : gspStatus?.configured ? "OTP REQUIRED" : "NOT CONFIGURED"}</em></summary>
          <div className={styles.detailGrid}>
            <span><b>Provider</b><small>{gspStatus?.provider_name || "Fynamics Techno Solutions Private Limited"}</small></span>
            <span><b>API version</b><small>{gspStatus?.api_version || "3.0.3"}</small></span>
            <span><b>Environment</b><small>{gspStatus?.environment || "—"}</small></span>
            <span><b>Taxpayer session</b><small>{gspStatus?.taxpayer_authenticated ? "Authenticated" : "Not authenticated"}</small></span>
            <span><b>Final EVC filing</b><small>{gspStatus?.filing_contract_ready ? "Acceptance-tested contract enabled" : "Sandbox acceptance pending"}</small></span>
            <span><b>Secrets</b><small>Tokens, SEK/AppKey, PAN and OTP are never persisted</small></span>
          </div>
          {gspStatus?.missing_configuration?.length ? <p className={styles.helper}>Missing backend configuration: {gspStatus.missing_configuration.join(", ")}</p> : null}
        </details>

        <details className={styles.settingsBlock}>
          <summary><span>IRIS IRP connector</span><em data-state={connector?.ready_for_live_irn ? "ok" : "warn"}>{connector?.ready_for_live_irn ? "IRN READY" : connector?.core_configured ? "GATED" : "NOT CONFIGURED"}</em></summary>
          <div className={styles.detailGrid}>
            <span><b>Provider</b><small>{connector?.provider || "IRIS_IRP"}</small></span>
            <span><b>Environment</b><small>{connector?.environment || "—"}</small></span>
            <span><b>Core credentials</b><small>{connector?.core_configured ? "Configured" : "Not configured"}</small></span>
            <span><b>e-Invoice</b><small>{connector?.einvoice_enabled ? "Enabled" : "Disabled"}</small></span>
            <span><b>Seller INV-01</b><small>{connector?.invoice_identity_configured ? "Configured" : "Incomplete"}</small></span>
            <span><b>Last operation</b><small>{connector?.last_operation ? connector.last_operation.operation + " · " + connector.last_operation.status : "None"}</small></span>
          </div>
          <div className={styles.settingsActions}>
            <button type="button" disabled={!canPrepare || !connector?.core_configured || Boolean(actionBusy)} onClick={() => void providerAction("health", "tax/gst/connector/health", undefined, () => "IRIS IRP health check succeeded.")}>
              {actionBusy === "health" ? <LoaderCircle className={styles.spin} /> : <ShieldCheck />} Test IRP
            </button>
          </div>
          {connector?.missing_configuration?.length ? <p className={styles.helper}>Missing: {connector.missing_configuration.join(", ")}. No credential value is exposed or stored in the browser.</p> : <p className={styles.helper}>{connector?.secret_storage}</p>}
        </details>

        <details className={styles.settingsBlock}>
          <summary><span>Product tax profiles</span><em>{taxProfiles.length}</em></summary>
          <div className={styles.tableWrap}>
            <table className={styles.profileTable}>
              <thead><tr><th>Product</th><th>Supply</th><th>SAC</th><th>GST</th><th>Billing</th><th>Review</th></tr></thead>
              <tbody>{taxProfiles.map((profile) => <tr key={profile.id}>
                <td><strong>{profile.product_code || "—"} · {profile.product_name}</strong><small>{profile.classification_basis}</small></td>
                <td>{profile.supply_model.replaceAll("_", " ")}</td>
                <td>{profile.sac}</td>
                <td>{profile.gst_rate}%</td>
                <td><em data-state={profile.billing_enabled ? "ok" : "neutral"}>{profile.billing_enabled ? "ENABLED" : "DISABLED"}</em></td>
                <td><em data-state={profile.status === "APPROVED" ? "ok" : "warn"}>{profile.status}</em><small>{profile.evidence_ref || "CA evidence required"}</small></td>
              </tr>)}</tbody>
            </table>
          </div>
        </details>

        <details className={styles.settingsBlock}>
          <summary><span>GST rate master & SAC reference</span><em>{gstMaster?.verified_on || "—"}</em></summary>
          <div className={styles.rateGrid}>
            {(gstMaster?.standard_rates || []).map((rate) => <span key={rate} data-default={rate === gstMaster?.it_services.default_rate}>{rate}%</span>)}
          </div>
          <p className={styles.helper}><b>IT services:</b> {gstMaster?.it_services.classification_note || "CBIC IT-service rate reference is 18%."}</p>
          <div className={styles.sacGrid}>{gstMaster?.it_services.sacs.map((item) => <span key={item.code}><b>{item.code}</b><small>{item.description}</small></span>)}</div>
        </details>

        <details className={styles.settingsBlock}>
          <summary><span>Control notes</span></summary>
          <div className={styles.controlNotes}>
            <article><Database /><div><b>Canonical source</b><span>Issued invoice snapshots drive output GST.</span></div></article>
            <article><ShieldCheck /><div><b>Input tax credit</b><span>Input tax credit is not calculated automatically; no net GST payable is claimed.</span></div></article>
            <article><FileCheck2 /><div><b>Filing evidence</b><span>No GST portal filing is performed or inferred without external authoritative evidence.</span></div></article>
          </div>
        </details>
      </div> : null}
    </>}
  </section>;
}
