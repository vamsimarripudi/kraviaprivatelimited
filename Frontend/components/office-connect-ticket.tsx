"use client";

import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {AlertTriangle,ArrowLeft,CheckCircle2,FileText,RefreshCw,ShieldCheck} from "lucide-react";
import styles from "./office-connect-ticket.module.css";
type Row={id:string;ticket_code:string;title:string;description:string;category:string;priority:string;status:string;
 requester_user_id:string;owner_user_id?:string|null;created_at:string;updated_at:string;due_at?:string|null;resolution?:string|null};
type EventRow={id:string;ticket_id:string;event_type:string;note?:string|null;created_at:string;previous_status?:string|null;new_status?:string|null};
type Person={user_id:string;display_name?:string|null;job_title?:string|null};
type Payload={tickets:Row[];events:EventRow[];identities:Person[];capabilities:{manage:boolean,read_company:boolean};
 actor:{user_id:string};disclaimer:string};
async function query<T>(url:string,init?:RequestInit):Promise<T>{
 const response=await fetch(url,{cache:"no-store",credentials:"same-origin",...init});
 const data=await response.json().catch(()=>({})) as T&{detail?:string};
 if(!response.ok)throw new Error(data.detail??"Canonical IT service unavailable");
 return data;
}
function date(d?:string|null){return d?new Date(d).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"Not set";}
const states=["OPEN","TRIAGED","IN_PROGRESS","WAITING_USER","WAITING_VENDOR","RESOLVED","CLOSED","CANCELLED"] as const;
export function OfficeConnectTicket({id}:{id:string}){
 const [data,setData]=useState<Payload|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [busy,setBusy]=useState(false);
 const [editing,setEditing]=useState(false);
 const [status,setStatus]=useState<string>("IN_PROGRESS");
 const [owner,setOwner]=useState("");
 const [note,setNote]=useState("");
 useEffect(()=>{
  let active=true;
  void query<Payload>("/api/office-it").then(v=>{if(active){setData(v);setError("");}})
   .catch(e=>{if(active){setData(null);setError(e instanceof Error?e.message:"IT service unavailable");}})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;};
 },[refresh]);
 const item=data?.tickets.find(t=>t.id===id);
 const events=data?.events.filter(e=>e.ticket_id===id)??[];
 async function transition(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!item||!data?.capabilities.manage||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await query<{status:string}>("/api/office-it",{method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({action:"TRANSITION_TICKET",ticket_id:item.id,status,
       owner_user_id:owner||undefined,note:note.trim()||undefined})});
   setNotice("Canonical IT ticket transition confirmed: "+result.status);
   setEditing(false);setNote("");setLoading(true);setRefresh(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:"The source did not confirm this transition");}
  finally{setBusy(false);}
 }
 return <section className={styles.shell} aria-label="Canonical IT ticket workspace">
  <header className={styles.header}><div><Link href="/office/chat/support"><ArrowLeft size={16}/>Support</Link>
    <p>KRAVIA CONNECT · SOURCE-OWNED IT</p><h1>IT ticket workspace</h1>
    <span>Only current requester, owner and assigned IT staff can read source records.</span></div>
    <button type="button" onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}><RefreshCw size={16}/>Refresh</button>
  </header>
  {notice?<p role="status" className={styles.notice}><CheckCircle2 size={17}/>{notice}</p>:null}
  {error?<div role="alert" className={styles.error}><AlertTriangle size={17}/>{error}</div>:null}
  {loading?<p role="status" aria-busy="true">Verifying current IT record permissions…</p>:null}
  {!loading&&!item?<div className={styles.empty}>The requested IT record is not visible under your current permissions.</div>:null}
  {!loading&&item?<div className={styles.columns}>
   <article className={styles.case}>
    <div className={styles.badge}>{item.ticket_code} · {item.priority} · {item.status}</div>
    <h2>{item.title}</h2><p>{item.description}</p>
    <h3>Source audit timeline</h3>
    {events.length?events.map(e=><div className={styles.event} key={e.id}>
      <strong>{e.event_type.replaceAll("_"," ")}</strong>
      <small>{date(e.created_at)} · {e.previous_status??"—"} → {e.new_status??"—"}</small>
      {e.note?<p>{e.note}</p>:null}
     </div>):<p>No timeline events are available to this actor.</p>}
   </article>
   <aside className={styles.inspector}><h2>Ticket inspector</h2>
    <dl><dt>Category</dt><dd>{item.category}</dd><dt>Created</dt><dd>{date(item.created_at)}</dd>
    <dt>Updated</dt><dd>{date(item.updated_at)}</dd><dt>Due</dt><dd>{date(item.due_at)}</dd>
    <dt>Owner</dt><dd>{data?.identities.find(p=>p.user_id===item.owner_user_id)?.display_name??"Assigned privately"}</dd>
    <dt>Resolution</dt><dd>{item.resolution??"Awaiting source record"}</dd></dl>
    {data?.capabilities.manage?<button type="button" onClick={()=>{setEditing(v=>!v);setStatus(item.status);setOwner(item.owner_user_id??"");setNote("");}}>
      {editing?"Close transition":"Update governed status"}</button>:null}
    <Link href="/office/chat/support/escalations">Escalation control</Link>
    <Link href="/office/it">Open original IT service desk</Link>
   </aside>
  </div>:null}
  {editing&&item&&data?.capabilities.manage?<form className={styles.form} onSubmit={transition}>
    <h2>Review and commit a canonical status transition</h2>
    <p>This records a source-system ticket transition. It is not a chat message, an approval, a customer-visible reply or an IT access grant.</p>
    <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>
      {states.map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Assigned owner<select value={owner} onChange={e=>setOwner(e.target.value)}>
      <option value="">Preserve current assignment</option>
      {data.identities.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name??p.job_title??p.user_id}</option>)}
     </select></label>
    <label>Internal transition note<textarea rows={4} minLength={0} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <div className={styles.actions}><button type="button" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button>
    <button type="submit" disabled={busy}>{busy?"Recording…":"Confirm source transition"}</button></div>
   </form>:null}
  <footer className={styles.footer}><ShieldCheck size={16}/>Only server-confirmed changes appear as success. The IT source retains ticket state, events and permissions.</footer>
 </section>;
}
