"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeIndianRupee, CircleAlert, FileCheck2, Landmark, LoaderCircle, RefreshCw, Scale, ShieldCheck, WalletCards } from "lucide-react";
import styles from "./office-finance-command-center.module.css";

type CommandCenter={
 financial:{issued_invoice_value:string;collected:string;receivables:string};
 attention:{open_notices:number;pending_approvals:number;unmatched_bank_transactions:number;pending_events:number};
 records:{customers:number;products:number;subscriptions:number;documents:number};
 source:string;
};
type GstSummary={net_taxable:string;cgst:string;sgst:string;igst:string;total:string;invoice_count:number;filing_status:string;note:string};
type TrialBalance={balanced:boolean;total_debit:string;total_credit:string;accounts:Array<{account_code:string;account_name:string;account_type:string;debit:string;credit:string;net_paise:number}>;control_note:string};
type FinanceReadiness={execution_mode:"disabled"|"sandbox"|"live";sandbox_ready:boolean;live_payout_credentials_configured:boolean;live_payout_registry_ready:boolean;webhook_secret_configured:boolean;live_variable_collection:string;secrets_exposed:boolean};
type PeriodLock={id:string;period_start:string;period_end:string;lock_type:string;status:string;reason:string};
type PaymentInstruction={id:string;direction:string;amount:string;provider:string;status:string;scheduled_for?:string|null;last_error?:string|null};
type Expense={id:string;title:string;amount:string;due_date?:string|null;status:string;funding_mode:string};
type BankTransaction={id:string;transaction_date:string;amount:string;direction:string;reference:string;match_status:string;source:string};

async function runtime<T>(path:string,signal?:AbortSignal):Promise<T>{
 const response=await fetch("/api/office-runtime/"+path,{credentials:"same-origin",cache:"no-store",signal});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof body.detail==="string"?body.detail:"Finance command-center request failed");
 return body as T;
}
function money(value:string|number){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0))}
function date(value?:string|null){if(!value)return "—";const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("en-IN",{dateStyle:"medium"}).format(d)}

export function OfficeFinanceCommandCenter(){
 const[data,setData]=useState<CommandCenter>();const[gst,setGst]=useState<GstSummary>();const[trial,setTrial]=useState<TrialBalance>();const[readiness,setReadiness]=useState<FinanceReadiness>();const[locks,setLocks]=useState<PeriodLock[]>([]);const[payments,setPayments]=useState<PaymentInstruction[]>([]);const[expenses,setExpenses]=useState<Expense[]>([]);const[bank,setBank]=useState<BankTransaction[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState<string>();
 const fetchRecords=useCallback((signal?:AbortSignal)=>Promise.all([runtime<CommandCenter>("command-center",signal),runtime<GstSummary>("tax/gst/summary",signal),runtime<TrialBalance>("accounting/trial-balance",signal),runtime<FinanceReadiness>("finance/readiness",signal),runtime<PeriodLock[]>("accounting/period-locks",signal),runtime<PaymentInstruction[]>("finance/payment-instructions",signal),runtime<Expense[]>("finance/expenses",signal),runtime<BankTransaction[]>("banking/transactions",signal)]),[]);
 const apply=useCallback(([c,g,t,r,l,p,e,b]:[CommandCenter,GstSummary,TrialBalance,FinanceReadiness,PeriodLock[],PaymentInstruction[],Expense[],BankTransaction[]])=>{setData(c);setGst(g);setTrial(t);setReadiness(r);setLocks(l);setPayments(p);setExpenses(e);setBank(b)},[]);
 const load=useCallback(async()=>{setLoading(true);setError(undefined);try{apply(await fetchRecords())}catch(caught){setError(caught instanceof Error?caught.message:"Unable to load finance command center")}finally{setLoading(false)}},[apply,fetchRecords]);
 useEffect(()=>{const controller=new AbortController();let active=true;void fetchRecords(controller.signal).then(records=>{if(active)apply(records)}).catch(caught=>{if(active&&!(caught instanceof DOMException&&caught.name==="AbortError"))setError(caught instanceof Error?caught.message:"Unable to load finance command center")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false;controller.abort()}},[apply,fetchRecords]);

 const outputGst=Number(gst?.cgst||0)+Number(gst?.sgst||0)+Number(gst?.igst||0);
 const activeLocks=locks.filter(l=>l.status==="LOCKED");
 const paymentExceptions=payments.filter(p=>["FAILED","PROCESSING","APPROVED","PENDING"].includes(p.status));
 const expenseExceptions=expenses.filter(e=>e.status!=="PAID");
 const bankExceptions=bank.filter(b=>b.match_status!=="MATCHED");
 const attention=useMemo(()=>[
  {label:"Pending approvals",value:data?.attention.pending_approvals||0,href:"/office/approvals",kind:"control"},
  {label:"Unmatched bank rows",value:bankExceptions.length,href:"/finance/reconciliation",kind:"control"},
  {label:"Open notices",value:data?.attention.open_notices||0,href:"/finance/compliance",kind:"control"},
  {label:"Active period locks",value:activeLocks.length,href:"/finance/accounting",kind:"control"},
  {label:"Open expenses",value:expenseExceptions.length,href:"/finance/expenses",kind:"control"},
  {label:"Payment exceptions",value:paymentExceptions.length,href:"/finance/payments",kind:"control"},
 ],[activeLocks.length,bankExceptions.length,data?.attention.open_notices,data?.attention.pending_approvals,expenseExceptions.length,paymentExceptions.length]);

 return <section className={styles.shell}>
  <header className={styles.hero}><div><p>KRAVIA FINANCE · COMMAND CENTER</p><h2>Exception-first finance visibility across billing, tax, books, banking and treasury.</h2><span>All values come from canonical runtime sources. This page does not infer bank balances, GST payable, compliance status or provider settlement where source evidence is absent.</span></div><div className={styles.mode} data-mode={readiness?.execution_mode||"disabled"}><ShieldCheck/><span>Payment execution</span><b>{(readiness?.execution_mode||"disabled").toUpperCase()}</b></div></header>
  <div className={styles.toolbar}><button type="button" onClick={()=>void load()} disabled={loading}><RefreshCw/>Refresh</button><Link href="/finance/billing"><BadgeIndianRupee/>Billing</Link><Link href="/finance/accounting"><Scale/>Accounting</Link><Link href="/finance/payments"><WalletCards/>Payments</Link></div>
  {error?<div className={styles.error}><CircleAlert/>{error}</div>:null}
  {loading?<div className={styles.state}><LoaderCircle className={styles.spin}/>Loading finance control plane…</div>:<>
   <div className={styles.metrics}>
    <article><span>Issued invoice value</span><b>{money(data?.financial.issued_invoice_value||0)}</b></article>
    <article><span>Collected</span><b>{money(data?.financial.collected||0)}</b></article>
    <article><span>Receivables</span><b>{money(data?.financial.receivables||0)}</b></article>
    <article><span>Output GST</span><b>{money(outputGst)}</b><small>ITC/payable not calculated</small></article>
    <article><span>Trial balance</span><b>{trial?.balanced?"Balanced":"Exception"}</b><small>{money(trial?.total_debit||0)} debit / {money(trial?.total_credit||0)} credit</small></article>
    <article><span>Invoices in GST register</span><b>{gst?.invoice_count||0}</b><small>{gst?.filing_status||"REVIEW_REQUIRED"}</small></article>
   </div>
   <section className={styles.panel}><header className={styles.panelHead}><div><p>ATTENTION QUEUE</p><h3>Items requiring finance review</h3></div><span>Counts are navigational signals only; each destination remains the source of truth.</span></header><div className={styles.attention}>{attention.map(item=><Link href={item.href} key={item.label}><strong>{item.value}</strong><span>{item.label}</span></Link>)}</div></section>
   <section className={styles.panel}><header className={styles.panelHead}><div><p>TREASURY READINESS</p><h3>Provider execution posture</h3></div><span>Secrets are never returned by the runtime.</span></header><div className={styles.readiness}>
    <article data-ready={Boolean(readiness?.live_payout_registry_ready)}><ShieldCheck/><div><b>RazorpayX registry</b><span>{readiness?.live_payout_registry_ready?"Ready":"Not ready"}</span></div></article>
    <article data-ready={Boolean(readiness?.live_payout_credentials_configured)}><FileCheck2/><div><b>Live credentials</b><span>{readiness?.live_payout_credentials_configured?"Configured":"Not configured"}</span></div></article>
    <article data-ready={Boolean(readiness?.webhook_secret_configured)}><Landmark/><div><b>Webhook verification</b><span>{readiness?.webhook_secret_configured?"Configured":"Not configured"}</span></div></article>
    <article data-ready={!readiness?.secrets_exposed}><ShieldCheck/><div><b>Secret exposure</b><span>{readiness?.secrets_exposed?"Unexpected exposure":"No secrets exposed"}</span></div></article>
   </div></section>
   <div className={styles.twoCol}>
    <section className={styles.panel}><header className={styles.panelHead}><div><p>PAYMENTS</p><h3>Current instruction exceptions</h3></div><Link href="/finance/payments">Open treasury</Link></header><div className={styles.list}>{paymentExceptions.slice(0,6).map(p=><article key={p.id}><div><b>{p.direction} · {money(p.amount)}</b><span>{p.provider} · {p.id}</span></div><em data-status={p.status}>{p.status}</em>{p.last_error?<small>{p.last_error}</small>:null}</article>)}{!paymentExceptions.length?<div className={styles.empty}>No payment exceptions.</div>:null}</div></section>
    <section className={styles.panel}><header className={styles.panelHead}><div><p>EXPENSES</p><h3>Outstanding obligations</h3></div><Link href="/finance/expenses">Open expenses</Link></header><div className={styles.list}>{expenseExceptions.slice(0,6).map(e=><article key={e.id}><div><b>{e.title}</b><span>{money(e.amount)} · due {date(e.due_date)} · {e.funding_mode}</span></div><em data-status={e.status}>{e.status}</em></article>)}{!expenseExceptions.length?<div className={styles.empty}>No open expense obligations.</div>:null}</div></section>
   </div>
   <p className={styles.source}>{data?.source||"KRAVIA Office canonical runtime"}</p>
  </>}
 </section>
}
