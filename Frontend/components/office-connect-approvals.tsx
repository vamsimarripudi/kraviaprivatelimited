"use client";
import {useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,CheckCheck,Clock3,ClipboardCheck,FileText,Filter,RefreshCw,ShieldCheck,TriangleAlert,X} from "lucide-react";
import styles from "./office-connect-approvals.module.css";

type RequestRow={
 id:string;title:string;description:string;priority:string;status:string;
 request_type_code:string;created_at:string;due_at?:string|null;
 requester_user_id:string;requester_department?:string|null;
};
type ApprovalRow={step:{
 id:string;request_id:string;step_order:number;step_code:string;label:string;
 status:string;assigned_user_id?:string|null;required_permission?:string|null;
};request:RequestRow|null};
type Overview={identity:{user_id:string};approvals:ApprovalRow[];detail?:string};
type Decision="APPROVE"|"REJECT";
const date=(value?:string|null)=>{
 if(!value)return "Not set";
 const parsed=new Date(value);
 return Number.isNaN(parsed.getTime())?"Unavailable":
  parsed.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
};
export function OfficeConnectApprovals({requestId}:{requestId?:string}){
 const [overview,setOverview]=useState<Overview|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 const [filter,setFilter]=useState<"ALL"|"URGENT"|"DUE">("ALL");
 const [search,setSearch]=useState("");
 const [pending,setPending]=useState(false);
 const [decision,setDecision]=useState<Decision|null>(null);
 const [reason,setReason]=useState("");
 const [confirmed,setConfirmed]=useState(false);
 const modal=useRef<HTMLDialogElement>(null);
 const trigger=useRef<HTMLButtonElement|null>(null);
 const inFlight=useRef(false);
 useEffect(()=>{
  const controller=new AbortController();
  void (async()=>{
   try{
    const response=await fetch("/api/office-work/overview",{cache:"no-store",
     credentials:"same-origin",signal:controller.signal});
    const body=await response.json().catch(()=>({})) as Overview;
    if(!response.ok||!Array.isArray(body.approvals)||!body.identity?.user_id){
     throw new Error(body.detail||"The formal decision queue is unavailable");
    }
    if(!controller.signal.aborted){setOverview(body);setError("");}
   }catch(e){
    if(!controller.signal.aborted){
      setOverview(null);setError(e instanceof Error?e.message:"Unable to load approval queue");
    }
   }finally{if(!controller.signal.aborted)setLoading(false);}
  })();
  return()=>controller.abort();
 },[refresh]);
 // Only current steps actually assigned by the canonical service are eligible.
 // Never treat a URL or current role label as authority to inspect a request.
 const rows=useMemo(()=>overview?.approvals.filter(({step,request})=>
   Boolean(request)&&step.status==="PENDING"&&
   step.assigned_user_id===overview.identity.user_id)??[],[overview]);
 const selected=requestId?rows.find(({request})=>request?.id===requestId):null;
 const visible=useMemo(()=>rows.filter(({request})=>{
   if(!request)return false;
   if(filter==="URGENT"&&!["HIGH","URGENT"].includes(request.priority))return false;
   if(filter==="DUE"&&(!request.due_at||new Date(request.due_at).getTime()>Date.now()))return false;
   const needle=search.trim().toLocaleLowerCase();
   return !needle||[request.title,request.request_type_code,request.priority].some(v=>v.toLocaleLowerCase().includes(needle));
 }),[rows,filter,search]);
 function open(next:Decision,button:HTMLButtonElement){
  if(pending)return;
  trigger.current=button;setDecision(next);setReason("");setConfirmed(false);
  modal.current?.showModal();
 }
 function close(){
  if(pending)return;
  modal.current?.close();setDecision(null);setReason("");setConfirmed(false);
  trigger.current?.focus();
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(pending||inFlight.current||!selected?.request||!decision||!confirmed||reason.trim().length<12)return;
  inFlight.current=true;setPending(true);setError("");setNotice("");
  try{
    const response=await fetch("/api/office-work/requests/"+
      encodeURIComponent(selected.request.id)+"/decision",{
       method:"PATCH",credentials:"same-origin",cache:"no-store",
       headers:{"Content-Type":"application/json"},
       body:JSON.stringify({decision,note:reason.trim()}),
    });
    const body=await response.json().catch(()=>({})) as {status?:string;detail?:string};
    if(!response.ok||typeof body.status!=="string"){
      throw new Error(body.detail||"The decision was not confirmed by the source");
    }
    modal.current?.close();setDecision(null);setReason("");setConfirmed(false);
    trigger.current?.focus();
    setNotice("Decision accepted by the canonical request workflow: "+body.status+
      ". Fulfilment is separately authorized.");
    setLoading(true);setRefresh(r=>r+1);
  }catch(e){setError(e instanceof Error?e.message:"The decision was not confirmed");}
  finally{setPending(false);inFlight.current=false;}
 }
 return <section className={styles.shell} aria-label={requestId?"Connect approval decision room":"Connect approval inbox"}>
   <Link className={styles.back} href={requestId?"/office/chat/approvals":"/office/chat"}>
    <ArrowLeft size={16}/>{requestId?"Approval inbox":"Connect"}</Link>
   <header className={styles.heading}><div>
    <p className={styles.eyebrow}>KRAVIA CONNECT · CANONICAL DECISIONS</p>
    <h1>{requestId?"Approval decision room":"Approval inbox"}</h1>
    <p>Only decisions currently assigned to your verified Office identity. No chat message can approve a request or fulfil an action.</p>
   </div><button type="button" disabled={loading||pending} onClick={()=>{
    setLoading(true);setRefresh(v=>v+1);
   }}><RefreshCw size={17}/>Refresh</button></header>
   {notice?<p className={styles.notice} role="status">{notice}</p>:null}
   {error?<div className={styles.error} role="alert">
     <TriangleAlert size={18}/><span>{error}</span>
     <button type="button" disabled={loading||pending} onClick={()=>{
      setLoading(true);setRefresh(v=>v+1);
     }}>Retry</button></div>:null}
   {loading?<p className={styles.state} role="status" aria-busy="true">Loading authorized decisions…</p>:null}
   {!loading&&!error&&requestId&&!selected?<div className={styles.state} role="status">
    <ShieldCheck size={22}/><h2>Decision unavailable</h2>
    <p>No currently assigned and pending approval is available under this identity. The request identifier does not authorize access.</p>
    <Link href="/office/chat/approvals">Return to my approvals</Link>
   </div>:null}
   {!loading&&!error&&!requestId?<><div className={styles.metrics}>
     <article><span>Assigned current steps</span><strong>{rows.length}</strong></article>
     <article><span>High priority</span><strong>{rows.filter(r=>["HIGH","URGENT"].includes(r.request?.priority||"")).length}</strong></article>
     <article><span>Past recorded due date</span><strong>{rows.filter(r=>r.request?.due_at&&Date.parse(r.request.due_at)<Date.now()).length}</strong></article>
    </div>
    <div className={styles.filters}><label><Filter size={16}/>Filter
      <select value={filter} onChange={e=>setFilter(e.target.value)}>
       <option value="ALL">All assigned</option><option value="URGENT">High priority</option>
       <option value="DUE">Past recorded due date</option>
      </select></label>
     <label>Search authorized decisions<input value={search} maxLength={100}
      onChange={e=>setSearch(e.target.value)} placeholder="Request title or type"/></label></div>
    <p role="status" className={styles.summary}>{visible.length} current decision(s) in this filter</p>
    {visible.length?<ol className={styles.queue}>{visible.map(item=><li key={item.step.id}>
      <ClipboardCheck size={21}/><div><h2>{item.request?.title}</h2>
       <p>{item.step.label} · {item.request?.request_type_code}</p>
       <small>{item.request?.priority} priority · Created {date(item.request?.created_at)} · Due {date(item.request?.due_at)}</small>
      </div><Link href={"/office/chat/approvals/"+item.request?.id}>Review evidence <ArrowRight size={17}/></Link>
     </li>)}</ol>:<p className={styles.state}>No assigned decisions match these filters.</p>}
    <p className={styles.note}>Approval steps are server-assigned and checked again on decision submission. See the <Link href="/office/approvals">formal Office workflow</Link> for broader request operations.</p>
   </>:null}
   {!loading&&!error&&selected?.request?<div className={styles.room}>
    <article className={styles.main}>
      <div className={styles.label}><FileText size={19}/>Pending independent decision</div>
      <h2>{selected.request.title}</h2>
      <p className={styles.description}>{selected.request.description}</p>
      <dl><dt>Request category</dt><dd>{selected.request.request_type_code}</dd>
       <dt>Priority</dt><dd>{selected.request.priority}</dd>
       <dt>Current state</dt><dd>{selected.request.status}</dd>
       <dt>Assigned step</dt><dd>{selected.step.label}</dd>
       <dt>Required permission</dt><dd>{selected.step.required_permission||"Canonical rule"}</dd>
       <dt>Received</dt><dd>{date(selected.request.created_at)}</dd>
       <dt>Due</dt><dd>{date(selected.request.due_at)}</dd></dl>
      <div className={styles.actions}>
       <button type="button" disabled={pending} onClick={e=>open("REJECT",e.currentTarget)}>Reject with reason</button>
       <button type="button" disabled={pending} onClick={e=>open("APPROVE",e.currentTarget)}>
        <CheckCheck size={16}/>Review for approval</button>
      </div>
    </article>
    <aside className={styles.inspector}>
      <h2><ShieldCheck size={18}/> Decision safeguards</h2>
      <p>Current step assignment, permission, independent maker-checker controls and any required fresh MFA are enforced by Office.</p>
      <p><Clock3 size={16}/>Request data is refreshed before each decision and permission is rechecked on the server.</p>
      <p>Do not rely on chat discussions as statutory or financial authorization.</p>
      <Link href="/office/approvals">Open authoritative decision history <ArrowRight size={15}/></Link>
    </aside>
   </div>:null}
   <dialog ref={modal} className={styles.dialog} onClose={()=>{
    setDecision(null);setReason("");setConfirmed(false);
    trigger.current?.focus();
   }} onCancel={e=>{if(pending)e.preventDefault();}}>
    {decision&&selected?.request?<form onSubmit={submit}>
     <header><div><p className={styles.eyebrow}>FORMAL DECISION · CONFIRMATION</p>
       <h2>{decision==="APPROVE"?"Approve":"Reject"} request</h2></div>
       <button type="button" aria-label="Close decision confirmation" disabled={pending} onClick={close}><X size={19}/></button>
     </header>
     <p className={styles.description}>{selected.request.title}</p>
     <label>Decision rationale<textarea required minLength={12} maxLength={2000} rows={4}
       value={reason} onChange={e=>setReason(e.target.value)}
       placeholder="Record the reviewed evidence and reason for this decision."/></label>
     <label className={styles.check}><input type="checkbox" checked={confirmed}
      onChange={e=>setConfirmed(e.target.checked)} required/>
      I have reviewed the evidence and understand that approval does not execute the underlying operation.</label>
     <div className={styles.actions}><button type="button" disabled={pending} onClick={close}>Cancel</button>
       <button type="submit" disabled={pending||!confirmed||reason.trim().length<12}>
        {pending?"Recording decision…":"Submit to Office approval engine"}</button></div>
    </form>:null}
   </dialog>
   <footer><ShieldCheck size={16}/>Only source-confirmed decisions are reported as accepted. Recipient or policy changes can revoke authority between viewing and submitting.</footer>
 </section>;
}
