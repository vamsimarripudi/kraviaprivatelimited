"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCheck, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import styles from "./office-connect-escalations.module.css";

type Ticket = { id: string; ticket_code: string; title: string; status: string; due_at?: string | null };
type Person = { user_id: string; display_name: string; status?: string };
type Escalation = {
 id:string; ticket_id:string; level:number; recipient_user_id:string; created_by:string;
 reason:string; source_due_at?:string|null; status:string; acknowledged_at?:string|null;
 resolved_at?:string|null; created_at:string; source_ticket?:Ticket|null;
};
type Event = {id:number;escalation_id:string;actor_user_id:string;event_type:string;note?:string|null;occurred_at:string};
type Overview = {actor_user_id:string;can_manage:boolean;identities:Person[];items:Escalation[];events:Event[]};
type ITOverview = {tickets:Ticket[]};
async function api<T>(url:string,init?:RequestInit):Promise<T> {
 const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...init});
 const body=await response.json().catch(()=>({})) as T&{detail?:string};
 if(!response.ok)throw new Error(body.detail??"The canonical escalation service is unavailable");
 return body;
}
function date(value?:string|null) {
 return value?new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"No source deadline";
}
export function OfficeConnectEscalations({detailId}:{detailId?:string}) {
 const [data,setData]=useState<Overview|null>(null);
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [busy,setBusy]=useState(false);
 const [ticketId,setTicketId]=useState("");
 const [recipientId,setRecipientId]=useState("");
 const [reason,setReason]=useState("");
 const [decision,setDecision]=useState<{id:string;action:"ACKNOWLEDGE"|"RESOLVE"}|null>(null);
 const [note,setNote]=useState("");
 const [showCreate,setShowCreate]=useState(false);
 const nonce=useRef<string|null>(null);
 useEffect(()=>{
   let alive=true;
   void (async()=>{
    try {
     const [result,source]=await Promise.all([
      api<Overview>("/api/office-chat/support/escalations"),
      api<ITOverview>("/api/office-it")
     ]);
     if(alive){setData(result);setTickets(source.tickets.filter(t=>!["RESOLVED","CLOSED","CANCELLED"].includes(t.status)));setError("");}
    }catch(e){if(alive){setError(e instanceof Error?e.message:"Escalation service unavailable");setData(null);}}
    finally{if(alive)setLoading(false);}
   })();
   return()=>{alive=false;};
 },[refresh]);
 const active=useMemo(()=>data?.items.filter(x=>["PENDING","ACKNOWLEDGED"].includes(x.status))??[],[data]);
 const selected=detailId?data?.items.find(x=>x.id===detailId):undefined;
 const openTicket=tickets.find(x=>x.id===ticketId);
 const latest=active.find(x=>x.ticket_id===ticketId);
 const proposedLevel=(latest?.level??1)+1;
 const availableRecipients=(data?.identities??[]).filter(x=>x.user_id!==data?.actor_user_id);
 const visibleRows=detailId?(selected?[selected]:[]):data?.items??[];
 async function mutate(body:Record<string,unknown>,message:string) {
  setBusy(true);setError("");setNotice("");
  try{
   await api("/api/office-chat/support/escalations",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),
   });
   setNotice(message);setLoading(true);setRefresh(v=>v+1);
   return true;
  }catch(e){setError(e instanceof Error?e.message:"The outcome was not confirmed");return false;}
  finally{setBusy(false);}
 }
 async function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!ticketId||!recipientId||proposedLevel>4||reason.trim().length<12)return;
  nonce.current??=window.crypto.randomUUID();
  const ok=await mutate({action:"CREATE",ticket_id:ticketId,recipient_id:recipientId,
    level:proposedLevel,reason:reason.trim(),request_nonce:nonce.current},
    "Authorized escalation recorded against the existing IT ticket");
  if(ok){nonce.current=null;setShowCreate(false);setTicketId("");setRecipientId("");setReason("");}
 }
 async function resolveAction(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!decision)return;
  const ok=await mutate({action:decision.action,escalation_id:decision.id,note:note.trim()},
    decision.action==="ACKNOWLEDGE"?"Escalation acknowledgement recorded":"Escalation resolved without closing the IT ticket");
  if(ok){setDecision(null);setNote("");}
 }
 const sourceScopeNotice="Escalation is a separate audited coordination workflow. It never changes the canonical ticket status, transfers statutory authority, or sends an external notification.";
 return <section className={styles.shell} aria-label="Connect IT escalation workflow">
  <header className={styles.header}>
   <div><Link href="/office/chat/support/escalations"><ArrowLeft size={16}/>Escalation inbox</Link>
    <p>KRAVIA CONNECT · GOVERNED SERVICE DESK</p>
    <h1>{detailId?"Escalation detail":"IT escalations"}</h1>
    <span>{sourceScopeNotice}</span>
   </div>
   <div className={styles.tools}>
    <button type="button" onClick={()=>{setLoading(true);setRefresh(v=>v+1);}} disabled={busy}><RefreshCw size={17}/>Refresh</button>
    {data?.can_manage&&!detailId?<button type="button" onClick={()=>setShowCreate(v=>!v)} disabled={busy}>
      {showCreate?"Close form":"Manual escalation"}</button>:null}
   </div>
  </header>
  {error?<div className={styles.error} role="alert"><AlertTriangle size={18}/><span>{error}</span><button type="button" onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>Retry</button></div>:null}
  {notice?<div className={styles.notice} role="status"><CheckCheck size={18}/>{notice}</div>:null}
  {loading?<p role="status" aria-busy="true">Checking current IT ticket and escalation permissions…</p>:null}
  {!loading&&data?.can_manage&&!detailId&&showCreate?
   <form className={styles.form} onSubmit={create}>
    <h2>Escalate an existing IT ticket</h2>
    <p>Choose a real authorized ticket and an active recipient. The server independently verifies that the recipient can read the IT ticket.</p>
    <label>Source ticket<select required value={ticketId} onChange={e=>{setTicketId(e.target.value);nonce.current=null;}}>
     <option value="">Select an active ticket</option>
     {tickets.map(t=><option key={t.id} value={t.id}>{t.ticket_code} · {t.title}</option>)}
    </select></label>
    <div className={styles.columns}>
     <label>Escalation level<input readOnly aria-readonly="true" value={ticketId?proposedLevel>4?"Maximum L4 reached":"L"+proposedLevel:"Select a ticket"}/></label>
     <label>Authorized recipient<select required value={recipientId} onChange={e=>{setRecipientId(e.target.value);nonce.current=null;}}>
       <option value="">Select recipient</option>
       {availableRecipients.map(x=><option key={x.user_id} value={x.user_id}>{x.display_name}</option>)}
      </select></label>
    </div>
    {openTicket?<p>Canonical source: {openTicket.ticket_code} · {openTicket.status} · deadline {date(openTicket.due_at)}</p>:null}
    <label>Impact and escalation rationale<textarea required minLength={12} maxLength={1000} rows={4} value={reason}
      onChange={e=>{setReason(e.target.value);nonce.current=null;}}/></label>
    <p>No automatic SLA escalation or notification is asserted. This is a deliberate manual, auditable request.</p>
    <div className={styles.actions}>
     <button type="button" disabled={busy} onClick={()=>setShowCreate(false)}>Cancel</button>
     <button type="submit" disabled={busy||!ticketId||!recipientId||proposedLevel>4||reason.trim().length<12}>
      {busy?"Recording…":"Record scoped escalation"}</button>
    </div>
   </form>:null}
  {!loading&&data?<div className={styles.summary}>
   <article><b>{data.items.length}</b><span>Visible escalations</span></article>
   <article><b>{active.length}</b><span>Active / acknowledged</span></article>
   <article><b>{active.filter(x=>x.recipient_user_id===data.actor_user_id&&x.status==="PENDING").length}</b><span>Awaiting your acknowledgement</span></article>
  </div>:null}
  {!loading&&data&&detailId&&!selected?<div className={styles.empty} role="status">Escalation unavailable to this identity. No record contents can be disclosed.</div>:null}
  {!loading&&data&&visibleRows.length===0&&!detailId?<div className={styles.empty}>No authorized IT escalation records. An empty queue is not an SLA success claim.</div>:null}
  {!loading&&data?<div className={styles.list}>
   {visibleRows.map(item=><article key={item.id} className={styles.card}>
    <div className={styles.cardTitle}><div>
      <small>Level {item.level} · {item.status} · {item.source_ticket?.ticket_code??"IT ticket"}</small>
      <h2>{item.source_ticket?.title??"Restricted service escalation"}</h2>
     </div>
     {!detailId?<Link href={"/office/chat/support/escalations/"+item.id}><ArrowRight size={15}/>Inspect</Link>:null}
    </div>
    <p>{item.reason}</p>
    <dl>
     <dt>Source due date</dt><dd>{date(item.source_due_at)}</dd>
     <dt>Escalated</dt><dd>{date(item.created_at)}</dd>
     <dt>Recipient</dt><dd>{data.identities.find(x=>x.user_id===item.recipient_user_id)?.display_name??"Authorized recipient"}</dd>
     <dt>Acknowledged</dt><dd>{item.acknowledged_at?date(item.acknowledged_at):"Pending"}</dd>
    </dl>
    {item.source_ticket?<Link href={"/office/chat/support/tickets/"+item.ticket_id}>Open canonical IT ticket <ArrowRight size={15}/></Link>:null}
    <div className={styles.actions}>
     {item.status==="PENDING"&&item.recipient_user_id===data.actor_user_id?
      <button type="button" disabled={busy} onClick={()=>{setDecision({id:item.id,action:"ACKNOWLEDGE"});setNote("");}}>Acknowledge</button>:null}
     {["PENDING","ACKNOWLEDGED"].includes(item.status)&&data.can_manage?
      <button type="button" disabled={busy} onClick={()=>{setDecision({id:item.id,action:"RESOLVE"});setNote("");}}>Close escalation only</button>:null}
    </div>
    {detailId?<div className={styles.audit}>
     <h3>Immutable escalation history</h3>
     {data.events.filter(e=>e.escalation_id===item.id).map(e=><p key={e.id}><Clock3 size={15}/> {e.event_type} · {date(e.occurred_at)} {e.note?"· "+e.note:""}</p>)}
    </div>:null}
   </article>)}
  </div>:null}
  {decision?<form className={styles.form} onSubmit={resolveAction}>
    <h2>{decision.action==="ACKNOWLEDGE"?"Confirm acknowledgement":"Resolve escalation only"}</h2>
    <p>Your current recipient and IT authority will be verified again. This does not close the underlying IT service ticket.</p>
    <label>{decision.action==="ACKNOWLEDGE"?"Acknowledgement note (optional)":"Resolution evidence and reason"}
     <textarea rows={3} minLength={decision.action==="RESOLVE"?10:0} maxLength={2000}
       required={decision.action==="RESOLVE"} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <div className={styles.actions}>
     <button type="button" disabled={busy} onClick={()=>setDecision(null)}>Cancel</button>
     <button type="submit" disabled={busy||decision.action==="RESOLVE"&&note.trim().length<10}>
      {busy?"Recording…":"Confirm canonical escalation event"}</button>
    </div>
   </form>:null}
  <footer className={styles.footer}><ShieldCheck size={16}/>{sourceScopeNotice}</footer>
 </section>;
}
