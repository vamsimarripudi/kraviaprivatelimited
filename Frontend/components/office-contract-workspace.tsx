"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleAlert, FileCheck2, LoaderCircle, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import styles from "./office-contract-workspace.module.css";

type Capabilities={obligation_read:boolean;obligation_manage:boolean;obligation_review:boolean;contract_draft:boolean;contract_review:boolean;contract_execute:boolean};
type Contract={id:string;contract_no:string;contract_type:string;counterparty_name:string;product_codes_json:string;effective_date:string;expiry_date?:string|null;notice_days?:number|null;value_paise?:number|null;status:string;document_ref?:string|null;owner?:string|null;created_at:string};
type Obligation={id:string;obligation_code:string;contract_id:string;obligation_type:string;title:string;description:string;owner_user_id:string;cadence:string;next_due_at?:string|null;evidence_required:boolean;status:string;source_clause_reference?:string|null;created_by:string;reviewed_by?:string|null;reviewed_at?:string|null;created_at:string;updated_at:string};
type Person={user_id:string;display_name?:string|null;job_title?:string|null;primary_department?:string|null};
type Event={id:number;obligation_id:string;actor_user_id:string;event_type:string;due_at?:string|null;evidence_reference?:string|null;note?:string|null;created_at:string};
type Payload={actor:{user_id:string;roles:string[]};capabilities:Capabilities;contracts:Contract[];obligations:Obligation[];people:Person[];events:Event[];disclaimer:string};
type View="contracts"|"obligations";
type Modal={kind:"CREATE";contract?:Contract}|{kind:"SATISFY";obligation:Obligation}|{kind:"REVIEW";obligation:Obligation};

async function api<T>(options?:RequestInit):Promise<T>{
 const response=await fetch("/api/office-contracts",{...options,cache:"no-store",credentials:"same-origin"});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof body.detail==="string"?body.detail:"Contract operation failed");
 return body as T;
}
function date(value?:string|null){if(!value)return "—";const d=new Date(value.length===10?value+"T00:00:00":value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:value.length>10?"short":undefined}).format(d)}
function money(value?:number|null){if(value==null)return "—";return "₹"+(value/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
function toIso(value?:string){if(!value)return undefined;const d=new Date(value);return Number.isNaN(d.getTime())?undefined:d.toISOString()}
function noticeDeadline(contract:Contract){
 if(!contract.expiry_date||contract.notice_days==null)return null;
 const d=new Date(contract.expiry_date+"T00:00:00");
 if(Number.isNaN(d.getTime()))return null;
 d.setDate(d.getDate()-contract.notice_days);
 return d.toISOString().slice(0,10);
}

export function OfficeContractWorkspace(){
 const[data,setData]=useState<Payload>();const[view,setView]=useState<View>("contracts");const[modal,setModal]=useState<Modal>();const[draft,setDraft]=useState<Record<string,string>>({});const[busy,setBusy]=useState(false);const[error,setError]=useState<string>();const[notice,setNotice]=useState<string>();
 async function reload(message?:string){const next=await api<Payload>();setData(next);if(message)setNotice(message)}
 useEffect(()=>{let alive=true;void api<Payload>().then(next=>{if(alive)setData(next)}).catch((caught:unknown)=>{if(alive)setError(caught instanceof Error?caught.message:"Unable to load contracts")});return()=>{alive=false}},[]);
 const contracts=useMemo(()=>new Map((data?.contracts??[]).map(row=>[row.id,row])),[data?.contracts]);
 const people=useMemo(()=>new Map((data?.people??[]).map(row=>[row.user_id,row])),[data?.people]);
 const latestEvent=useMemo(()=>{const map=new Map<string,Event>();for(const row of data?.events??[])if(!map.has(row.obligation_id))map.set(row.obligation_id,row);return map},[data?.events]);

 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!modal)return;setBusy(true);setError(undefined);try{
  if(modal.kind==="CREATE")await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   action:"CREATE_OBLIGATION",contract_id:draft.contract_id||modal.contract?.id,obligation_type:draft.obligation_type||"OTHER",
   title:draft.title,description:draft.description,owner_user_id:draft.owner_user_id,cadence:draft.cadence||"ONCE",
   next_due_at:toIso(draft.next_due_at),evidence_required:draft.evidence_required!=="NO",source_clause_reference:draft.source_clause_reference||undefined,
  })});
  else if(modal.kind==="SATISFY")await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"SATISFY_OBLIGATION",obligation_id:modal.obligation.id,evidence:draft.evidence||undefined,note:draft.note||undefined})});
  else await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"REVIEW_OBLIGATION",obligation_id:modal.obligation.id,review_action:draft.review_action,evidence:draft.evidence||undefined,note:draft.note||undefined})});
  await reload("Contract obligation updated.");setModal(undefined);setDraft({});
 }catch(caught){setError(caught instanceof Error?caught.message:"Contract action failed")}finally{setBusy(false)}}

 if(error&&!data)return <section className={styles.state}><CircleAlert/><div><h2>Contracts unavailable</h2><p>{error}</p></div></section>;
 if(!data)return <section className={styles.state}><LoaderCircle className={styles.spin}/><div><h2>Loading contracts</h2><p>Resolving registry and obligation authority.</p></div></section>;
 const open=data.obligations.filter(row=>["ACTIVE","PAUSED"].includes(row.status)).length;
 const recurring=data.obligations.filter(row=>row.status==="ACTIVE"&&row.cadence!=="ONCE").length;

 return <section className={styles.shell}>
  <header className={styles.hero}><div><p>CONTRACTS · OBLIGATIONS · EVIDENCE</p><h2>Turn signed agreements into owned, time-bound operational work.</h2><span>{data.disclaimer}</span></div><div className={styles.metrics}><article><b>{data.contracts.length}</b><span>contracts</span></article><article><b>{open}</b><span>open obligations</span></article><article><b>{recurring}</b><span>recurring duties</span></article></div></header>
  <div className={styles.toolbar}><button type="button" data-active={view==="contracts"} onClick={()=>setView("contracts")}>Contract registry</button><button type="button" data-active={view==="obligations"} onClick={()=>setView("obligations")}>Obligations</button><button type="button" onClick={()=>void reload()}><RefreshCw/>Refresh</button>{view==="obligations"&&data.capabilities.obligation_manage&&data.contracts.length?<button type="button" onClick={()=>{setDraft({cadence:"ONCE",obligation_type:"OTHER",evidence_required:"YES"});setModal({kind:"CREATE"})}}><Plus/>New obligation</button>:null}</div>
  {notice?<div className={styles.notice}><BadgeCheck/>{notice}</div>:null}{error?<div className={styles.error}><CircleAlert/>{error}</div>:null}

  {view==="contracts"?<div className={styles.grid}>{data.contracts.map(c=>{const deadline=noticeDeadline(c);const count=data.obligations.filter(o=>o.contract_id===c.id&&["ACTIVE","PAUSED"].includes(o.status)).length;return <article className={styles.card} key={c.id}><header><div><small>{c.contract_no} · {c.contract_type}</small><h3>{c.counterparty_name}</h3><span>{c.owner||"No owner recorded"}</span></div><em className={styles.badge} data-status={c.status}>{c.status}</em></header><div className={styles.kv}><span>Effective<b>{date(c.effective_date)}</b></span><span>Expiry<b>{date(c.expiry_date)}</b></span><span>Notice deadline<b>{date(deadline)}</b></span><span>Value<b>{money(c.value_paise)}</b></span><span>Open duties<b>{count}</b></span><span>Document<b>{c.document_ref||"—"}</b></span></div>{data.capabilities.obligation_manage?<div className={styles.actions}><button type="button" onClick={()=>{setDraft({contract_id:c.id,cadence:"ONCE",obligation_type:"OTHER",evidence_required:"YES"});setModal({kind:"CREATE",contract:c})}}><Plus/>Add obligation</button></div>:null}</article>})}{!data.contracts.length?<div className={styles.empty}>No canonical contract records exist yet.</div>:null}</div>:null}

  {view==="obligations"?<div className={styles.grid}>{data.obligations.map(o=>{const c=contracts.get(o.contract_id);const ev=latestEvent.get(o.id);return <article className={styles.card} key={o.id}><header><div><small>{o.obligation_code} · {o.obligation_type}</small><h3>{o.title}</h3><span>{c?c.contract_no+" · "+c.counterparty_name:o.contract_id}</span></div><em className={styles.badge} data-status={o.status}>{o.status}</em></header><p>{o.description}</p><div className={styles.kv}><span>Owner<b>{people.get(o.owner_user_id)?.display_name||o.owner_user_id}</b></span><span>Cadence<b>{o.cadence}</b></span><span>Next due<b>{date(o.next_due_at)}</b></span><span>Evidence<b>{o.evidence_required?"Required":"Optional"}</b></span><span>Clause/source<b>{o.source_clause_reference||"—"}</b></span><span>Last event<b>{ev?ev.event_type+" · "+date(ev.created_at):"—"}</b></span></div><div className={styles.actions}>{o.status==="ACTIVE"&&(o.owner_user_id===data.actor.user_id||data.capabilities.obligation_manage)?<button type="button" onClick={()=>{setDraft({evidence:"",note:""});setModal({kind:"SATISFY",obligation:o})}}><FileCheck2/>Record fulfillment</button>:null}{data.capabilities.obligation_review&&["ACTIVE","PAUSED"].includes(o.status)&&o.owner_user_id!==data.actor.user_id&&o.created_by!==data.actor.user_id?<button type="button" onClick={()=>{setDraft({review_action:o.status==="PAUSED"?"RESUME":"WAIVE",evidence:"",note:""});setModal({kind:"REVIEW",obligation:o})}}><ShieldCheck/>Independent review</button>:null}</div></article>})}{!data.obligations.length?<div className={styles.empty}>No contract obligations have been recorded.</div>:null}</div>:null}

  {modal?<div className={styles.backdrop} role="presentation" onMouseDown={()=>!busy&&setModal(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={e=>e.stopPropagation()}><header><div><small>CONTROLLED CONTRACT ACTION</small><h3>{modal.kind.replaceAll("_"," ")}</h3></div><button type="button" aria-label="Close" onClick={()=>setModal(undefined)}><X/></button></header>
   {modal.kind==="CREATE"?<><label>Contract<select required value={draft.contract_id||modal.contract?.id||""} onChange={e=>setDraft({...draft,contract_id:e.target.value})}><option value="">Select contract</option>{data.contracts.map(c=><option key={c.id} value={c.id}>{c.contract_no} · {c.counterparty_name}</option>)}</select></label><div className={styles.two}><label>Type<select value={draft.obligation_type||"OTHER"} onChange={e=>setDraft({...draft,obligation_type:e.target.value})}>{["PAYMENT","SLA","NOTICE","RENEWAL","SECURITY","PRIVACY","REPORTING","INSURANCE","DATA","DELIVERY","SUPPORT","OTHER"].map(v=><option key={v}>{v}</option>)}</select></label><label>Owner<select required value={draft.owner_user_id||""} onChange={e=>setDraft({...draft,owner_user_id:e.target.value})}><option value="">Select owner</option>{data.people.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name||p.user_id}</option>)}</select></label></div><label>Title<input required minLength={3} value={draft.title||""} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>Description<textarea required minLength={3} value={draft.description||""} onChange={e=>setDraft({...draft,description:e.target.value})}/></label><div className={styles.two}><label>Cadence<select value={draft.cadence||"ONCE"} onChange={e=>setDraft({...draft,cadence:e.target.value})}>{["ONCE","MONTHLY","QUARTERLY","ANNUAL","ONGOING"].map(v=><option key={v}>{v}</option>)}</select></label><label>Next due<input required={draft.cadence!=="ONGOING"} type="datetime-local" value={draft.next_due_at||""} onChange={e=>setDraft({...draft,next_due_at:e.target.value})}/></label></div><div className={styles.two}><label>Evidence required<select value={draft.evidence_required||"YES"} onChange={e=>setDraft({...draft,evidence_required:e.target.value})}><option>YES</option><option>NO</option></select></label><label>Clause/source reference<input value={draft.source_clause_reference||""} onChange={e=>setDraft({...draft,source_clause_reference:e.target.value})}/></label></div></>
   :modal.kind==="SATISFY"?<><p>Record fulfillment for <b>{modal.obligation.title}</b>.</p>{modal.obligation.evidence_required?<label>Evidence reference<input required minLength={3} value={draft.evidence||""} onChange={e=>setDraft({...draft,evidence:e.target.value})}/></label>:<label>Evidence reference<input value={draft.evidence||""} onChange={e=>setDraft({...draft,evidence:e.target.value})}/></label>}<label>Note<textarea value={draft.note||""} onChange={e=>setDraft({...draft,note:e.target.value})}/></label></>
   :<><label>Review action<select value={draft.review_action||"WAIVE"} onChange={e=>setDraft({...draft,review_action:e.target.value})}>{(modal.obligation.status==="PAUSED"?["RESUME","CLOSE","CANCEL"]:["WAIVE","EXCEPTION","PAUSE","CLOSE","CANCEL"]).map(v=><option key={v}>{v}</option>)}</select></label>{["WAIVE","EXCEPTION","CLOSE"].includes(draft.review_action||"WAIVE")?<label>Review evidence<input required minLength={3} value={draft.evidence||""} onChange={e=>setDraft({...draft,evidence:e.target.value})}/></label>:null}<label>Review note<textarea required={["WAIVE","EXCEPTION","CLOSE","CANCEL"].includes(draft.review_action||"WAIVE")} value={draft.note||""} onChange={e=>setDraft({...draft,note:e.target.value})}/></label></>}
   <footer><button type="button" disabled={busy} onClick={()=>setModal(undefined)}>Cancel</button><button type="submit" disabled={busy}>{busy?<LoaderCircle className={styles.spin}/>:<ShieldCheck/>}Confirm</button></footer>
  </form></div>:null}
 </section>;
}
