"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleAlert, FileCheck2, HandCoins, LoaderCircle, RefreshCw, Scale, ShieldCheck, X } from "lucide-react";
import styles from "./office-expenses.module.css";

type Expense={id:string;vendor_id?:string|null;reference:string;title:string;category:string;amount:string;due_date?:string|null;funding_mode:"COMPANY_FUNDS"|"SHAREHOLDER_CONTRIBUTION";funding_policy_id?:string|null;status:string;approval_request_id?:string|null;approved_by?:string|null};
type FundingPolicy={id:string;name:string;allocation_basis:string;frequency:string;max_call?:string|null;status:string;source_document_ref:string;approved_by?:string|null};
type Vendor={id:string;legal_name:string;category:string;status:string;risk:string};
type Approval={id:string;action_type:string;entity_type:string;entity_id:string;requested_by:string;required_role:string;status:"PENDING"|"APPROVED"|"REJECTED";decided_by?:string|null;decision_reason?:string|null};
type Dialog={kind:"EXPENSE"}|{kind:"DECIDE";expense:Expense;approval:Approval;decision:"approve"|"reject"};
type Draft=Record<string,string>;

async function runtime<T>(path:string,options?:RequestInit):Promise<T>{
 const response=await fetch("/api/office-runtime/"+path,{...options,credentials:"same-origin",cache:"no-store"});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof body.detail==="string"?body.detail:"Expense runtime request failed");
 return body as T;
}
function headers(){return {"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()}}
function money(value:string|number){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0))}
function date(value?:string|null){if(!value)return "—";const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("en-IN",{dateStyle:"medium"}).format(d)}

export function OfficeExpensesWorkspace({canCreate,canDecide,canApplyApproval}:{canCreate:boolean;canDecide:boolean;canApplyApproval:boolean}){
 const[expenses,setExpenses]=useState<Expense[]>([]);const[policies,setPolicies]=useState<FundingPolicy[]>([]);const[vendors,setVendors]=useState<Vendor[]>([]);const[approvals,setApprovals]=useState<Approval[]>([]);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);const[dialog,setDialog]=useState<Dialog>();const[draft,setDraft]=useState<Draft>({});const[error,setError]=useState<string>();const[notice,setNotice]=useState<string>();
 const fetchRecords=useCallback(()=>Promise.all([runtime<Expense[]>("finance/expenses"),runtime<FundingPolicy[]>("finance/funding-policies"),runtime<Vendor[]>("vendors"),runtime<Approval[]>("approvals")]),[]);
 const applyRecords=useCallback(([e,p,v,a]:[Expense[],FundingPolicy[],Vendor[],Approval[]])=>{setExpenses(e);setPolicies(p);setVendors(v);setApprovals(a)},[]);
 const load=useCallback(async()=>{setLoading(true);setError(undefined);try{applyRecords(await fetchRecords())}catch(caught){setError(caught instanceof Error?caught.message:"Unable to load expenses")}finally{setLoading(false)}},[applyRecords,fetchRecords]);
 useEffect(()=>{let active=true;void fetchRecords().then(records=>{if(active)applyRecords(records)}).catch(caught=>{if(active)setError(caught instanceof Error?caught.message:"Unable to load expenses")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[applyRecords,fetchRecords]);

 const vendorMap=useMemo(()=>new Map(vendors.map(v=>[v.id,v])),[vendors]);
 const policyMap=useMemo(()=>new Map(policies.map(p=>[p.id,p])),[policies]);
 const approvalMap=useMemo(()=>new Map(approvals.filter(a=>a.action_type==="EXPENSE_APPROVE"&&a.entity_type==="expense").map(a=>[a.entity_id,a])),[approvals]);
 const activePolicies=policies.filter(p=>p.status==="ACTIVE");
 const openValue=expenses.filter(e=>e.status!=="PAID").reduce((sum,e)=>sum+Number(e.amount||0),0);

 async function refresh(message:string){setNotice(message);setDialog(undefined);setDraft({});await load()}
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!dialog)return;setBusy(true);setError(undefined);try{
  if(dialog.kind==="EXPENSE"){
   const shareholder=draft.funding_mode==="SHAREHOLDER_CONTRIBUTION";
   await runtime("finance/expenses",{method:"POST",headers:headers(),body:JSON.stringify({vendor_id:draft.vendor_id||undefined,reference:draft.reference,title:draft.title,category:draft.category,amount:Number(draft.amount||"0"),due_date:draft.due_date||undefined,funding_mode:shareholder?"SHAREHOLDER_CONTRIBUTION":"COMPANY_FUNDS",funding_policy_id:shareholder?draft.funding_policy_id:undefined,source_document_ref:draft.source_document_ref,note:draft.note||undefined})});
   await refresh("Expense obligation created. Independent approval is required before it becomes payout-eligible.");
  }else{
   await runtime("approvals/"+encodeURIComponent(dialog.approval.id)+"/"+dialog.decision,{method:"POST",headers:headers(),body:JSON.stringify({reason:draft.reason||undefined})});
   await refresh("Expense approval decision recorded through maker-checker controls.");
  }
 }catch(caught){setError(caught instanceof Error?caught.message:"Expense action failed")}finally{setBusy(false)}}

 async function applyApproval(expense:Expense){setBusy(true);setError(undefined);try{
  await runtime("finance/expenses/"+encodeURIComponent(expense.id)+"/approve",{method:"POST",headers:headers(),body:"{}"});
  await refresh("Approved decision applied. The expense is now eligible for the next controlled funding/payment step.");
 }catch(caught){setError(caught instanceof Error?caught.message:"Expense approval could not be applied")}finally{setBusy(false)}}

 return <section className={styles.shell}>
  <header className={styles.hero}><div><p>EXPENSES · FUNDING</p><h2>Record company obligations, keep funding source explicit, and require independent approval before payout eligibility.</h2><span>Shareholder contributions fund an expense; they do not change legal share ownership. Equity changes remain in the separate ownership ledger.</span></div><div className={styles.guard}><Scale/><span>Control boundary</span><b>Expense ≠ ownership change</b></div></header>
  <div className={styles.toolbar}><button type="button" onClick={()=>void load()} disabled={loading||busy}><RefreshCw/>Refresh</button>{canCreate?<button type="button" onClick={()=>{setDraft({funding_mode:"COMPANY_FUNDS"});setDialog({kind:"EXPENSE"})}} disabled={busy}><HandCoins/>Create expense</button>:null}<Link href="/finance/payments"><FileCheck2/>Open Payments</Link></div>
  {notice?<div className={styles.notice}><BadgeCheck/>{notice}</div>:null}{error?<div className={styles.error}><CircleAlert/>{error}</div>:null}
  {loading?<div className={styles.state}><LoaderCircle className={styles.spin}/>Loading canonical expense controls…</div>:<>
   <div className={styles.metrics}><article><span>Expense obligations</span><b>{expenses.length}</b></article><article><span>Open obligation value</span><b>{money(openValue)}</b></article><article><span>Active funding policies</span><b>{activePolicies.length}</b></article><article><span>Approved expenses</span><b>{expenses.filter(e=>e.status==="APPROVED").length}</b></article></div>
   <section className={styles.panel}><header className={styles.panelHead}><div><p>FUNDING POLICIES</p><h3>Approved shareholder contribution rules</h3></div><span>Only ACTIVE policies can be attached to new shareholder-funded expenses.</span></header><div className={styles.policyGrid}>{policies.map(p=><article key={p.id} className={styles.policy}><ShieldCheck/><div><small>{p.allocation_basis} · {p.frequency}</small><h4>{p.name}</h4><span>Maximum call: {p.max_call?money(p.max_call):"No configured maximum"} · evidence {p.source_document_ref}</span></div><em data-status={p.status}>{p.status}</em></article>)}{!policies.length?<div className={styles.empty}>No funding policies are recorded.</div>:null}</div></section>
   <section className={styles.panel}><header className={styles.panelHead}><div><p>EXPENSE REGISTER</p><h3>Obligations and approval state</h3></div><span>Approved expenses become eligible for separate payout staging; creating or approving an expense never executes payment.</span></header><div className={styles.cards}>{expenses.map(expense=>{const approval=approvalMap.get(expense.id);const vendor=expense.vendor_id?vendorMap.get(expense.vendor_id):undefined;const policy=expense.funding_policy_id?policyMap.get(expense.funding_policy_id):undefined;return <article className={styles.card} key={expense.id}><header><div><small>{expense.reference} · {expense.category}</small><h4>{expense.title}</h4></div><em data-status={expense.status}>{expense.status}</em></header><div className={styles.amount}>{money(expense.amount)}</div><dl><div><dt>Vendor</dt><dd>{vendor?.legal_name||"Not linked"}</dd></div><div><dt>Due</dt><dd>{date(expense.due_date)}</dd></div><div><dt>Funding</dt><dd>{expense.funding_mode}</dd></div><div><dt>Policy</dt><dd>{policy?.name||"—"}</dd></div><div><dt>Approved by</dt><dd>{expense.approved_by||"—"}</dd></div></dl>{approval?<div className={styles.approval}><ShieldCheck/><div><b>Maker-checker · {approval.status}</b><span>{approval.id} · requires {approval.required_role}</span></div></div>:null}<div className={styles.actions}>{approval?.status==="PENDING"&&canDecide?<><button type="button" disabled={busy} onClick={()=>{setDraft({});setDialog({kind:"DECIDE",expense,approval,decision:"approve"})}}><BadgeCheck/>Approve request</button><button type="button" disabled={busy} onClick={()=>{setDraft({});setDialog({kind:"DECIDE",expense,approval,decision:"reject"})}}><CircleAlert/>Reject</button></>:null}{approval?.status==="APPROVED"&&expense.status!=="APPROVED"&&canApplyApproval?<button type="button" disabled={busy} onClick={()=>void applyApproval(expense)}><ShieldCheck/>Apply approval</button>:null}{expense.status==="APPROVED"?<Link href="/finance/payments">Stage payment <FileCheck2/></Link>:null}</div></article>})}{!expenses.length?<div className={styles.empty}>No expense obligations have been recorded.</div>:null}</div></section>
  </>}
  {dialog?<div className={styles.backdrop} role="presentation" onMouseDown={()=>!busy&&setDialog(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={e=>e.stopPropagation()}><header><div><small>FINANCE CONTROL</small><h3>{dialog.kind==="EXPENSE"?"Create expense obligation":(dialog.decision==="approve"?"Approve":"Reject")+" expense request"}</h3></div><button type="button" aria-label="Close" disabled={busy} onClick={()=>setDialog(undefined)}><X/></button></header>{dialog.kind==="EXPENSE"?<>
   <div className={styles.two}><label>Reference<input required minLength={2} maxLength={100} value={draft.reference||""} onChange={e=>setDraft({...draft,reference:e.target.value})}/></label><label>Category<input required minLength={2} maxLength={120} value={draft.category||""} onChange={e=>setDraft({...draft,category:e.target.value})}/></label></div>
   <label>Title<input required minLength={2} maxLength={240} value={draft.title||""} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
   <div className={styles.two}><label>Amount<input required type="number" min="0.01" step="0.01" value={draft.amount||""} onChange={e=>setDraft({...draft,amount:e.target.value})}/></label><label>Due date<input type="date" value={draft.due_date||""} onChange={e=>setDraft({...draft,due_date:e.target.value})}/></label></div>
   <label>Vendor<select value={draft.vendor_id||""} onChange={e=>setDraft({...draft,vendor_id:e.target.value})}><option value="">No vendor linked</option>{vendors.filter(v=>v.status==="ACTIVE").map(v=><option key={v.id} value={v.id}>{v.legal_name} · {v.category}</option>)}</select></label>
   <label>Funding mode<select value={draft.funding_mode||"COMPANY_FUNDS"} onChange={e=>setDraft({...draft,funding_mode:e.target.value,funding_policy_id:""})}><option value="COMPANY_FUNDS">Company funds</option><option value="SHAREHOLDER_CONTRIBUTION">Shareholder contribution</option></select></label>
   {draft.funding_mode==="SHAREHOLDER_CONTRIBUTION"?<label>Active funding policy<select required value={draft.funding_policy_id||""} onChange={e=>setDraft({...draft,funding_policy_id:e.target.value})}><option value="">Select active policy</option>{activePolicies.map(p=><option key={p.id} value={p.id}>{p.name}{p.max_call?" · max "+money(p.max_call):""}</option>)}</select></label>:null}
   <label>Evidence / source document reference<input required minLength={2} value={draft.source_document_ref||""} onChange={e=>setDraft({...draft,source_document_ref:e.target.value})}/></label><label>Note<textarea value={draft.note||""} onChange={e=>setDraft({...draft,note:e.target.value})}/></label><p className={styles.warning}>The backend rejects inactive shareholder funding policies and expenses above the policy maximum call.</p>
  </>:<><p>Expense <b>{dialog.expense.reference}</b> · {money(dialog.expense.amount)}</p><label>Decision reason<textarea value={draft.reason||""} onChange={e=>setDraft({...draft,reason:e.target.value})}/></label><p className={styles.warning}>The requester cannot decide their own approval; the backend enforces maker-checker separation.</p></>}
  <footer><button type="button" disabled={busy} onClick={()=>setDialog(undefined)}>Cancel</button><button type="submit" disabled={busy}>{busy?<LoaderCircle className={styles.spin}/>:<BadgeCheck/>}Confirm</button></footer></form></div>:null}
 </section>
}
