"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,LockKeyhole,Mail,RefreshCw,Search,ShieldCheck,TriangleAlert} from "lucide-react";
import styles from "./office-connect-integrations.module.css";
type LifecyclePolicy={
 event_code:string;priority:string;source_ready:boolean;enabled:boolean;
 delivery_owner:string;intent:string;subject:string;approved_at:string|null;
};
type Lifecycle={policies:LifecyclePolicy[];total:number;enabled:number;source_ready:number;
 counts_by_source?:Record<string,Record<string,number|null>>;notice:string;detail?:string};
type Employee={kind:string;enabled:boolean;approved_at:string|null;effective_from:string|null;
 count_by_status?:Record<string,number|null>;note:string;detail?:string};
type Status<T>={status:"ok";data:T}|{status:"denied"|"unavailable";detail:string};
type View={lifecycle:Status<Lifecycle>;employee:Status<Employee>};
async function inspect<T>(path:string,signal:AbortSignal):Promise<Status<T>>{
 try{
  const response=await fetch(path,{cache:"no-store",credentials:"same-origin",signal});
  const data=await response.json().catch(()=>({})) as T&{detail?:string};
  if(response.status===401||response.status===403)
    return {status:"denied",detail:"Current corporate mail-policy access is not assigned"};
  if(!response.ok)return {status:"unavailable",detail:data.detail||"Authoritative policy unavailable"};
  return {status:"ok",data};
 }catch(error){
  if(signal.aborted)throw error;
  return {status:"unavailable",detail:"Could not verify provider-control policy"};
 }
}
const count=(value:number|null|undefined)=>typeof value==="number"?value.toLocaleString("en-IN"):"Unknown";
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"Not recorded";
export function OfficeConnectIntegrations(){
 const [view,setView]=useState<View|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 const [query,setQuery]=useState("");
 const [owner,setOwner]=useState("ALL");
 useEffect(()=>{
  const controller=new AbortController();
  void Promise.all([
    inspect<Lifecycle>("/api/office-lifecycle-mail-policy",controller.signal),
    inspect<Employee>("/api/office-employee-mail-policy",controller.signal),
  ]).then(([lifecycle,employee])=>{
    if(!controller.signal.aborted){setView({lifecycle,employee});setError("");}
  }).catch(()=>{
    if(!controller.signal.aborted){setView(null);setError("Policy snapshot unavailable");}
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[refresh]);
 const policies=useMemo(()=>view?.lifecycle.status==="ok"?view.lifecycle.data.policies:[],[view]);
 const owners=useMemo(()=>["ALL",...new Set(policies.map(p=>p.delivery_owner))],[policies]);
 const visible=useMemo(()=>policies.filter(p=>{
  const needle=query.trim().toLowerCase();
  if(owner!=="ALL"&&p.delivery_owner!==owner)return false;
  return !needle||[p.event_code,p.intent,p.subject,p.delivery_owner].some(s=>s.toLowerCase().includes(needle));
 }),[policies,owner,query]);
 return <section className={styles.shell} aria-label="Connect email and integration governance">
  <Link href="/office/chat/admin" className={styles.back}><ArrowLeft size={16}/>Connect administration</Link>
  <header className={styles.head}><div><p className={styles.eyebrow}>KRAVIA CONNECT · EXTERNAL COMMUNICATION CONTROL</p>
    <h1>Email & integration rules</h1>
    <p>Read-only authoritative delivery policies. No mailbox is read, sender verified, external email sent or integration activated here.</p>
   </div><button type="button" disabled={loading} onClick={()=>{
     setLoading(true);setRefresh(v=>v+1);
   }}><RefreshCw size={16}/>Refresh</button>
  </header>
  {error?<div className={styles.alert} role="alert"><TriangleAlert size={18}/>{error}</div>:null}
  {loading?<p role="status" aria-busy="true" className={styles.state}>Checking current delivery policies…</p>:null}
  {!loading&&view?<><div className={styles.summary}>
    <section><h2><Mail size={18}/>Lifecycle communication policy</h2>
     {view.lifecycle.status==="ok"?<div className={styles.metrics}>
       <article><span>Registered events</span><strong>{view.lifecycle.data.total}</strong></article>
       <article><span>Ready source pathways</span><strong>{view.lifecycle.data.source_ready}</strong></article>
       <article><span>Approved for eligibility</span><strong>{view.lifecycle.data.enabled}</strong></article>
      </div>:<p role="status" className={styles.blocked}><LockKeyhole size={16}/>{view.lifecycle.detail}</p>}
     <Link href="/office/settings">Open authoritative policy controls <ArrowRight size={16}/></Link>
    </section>
    <section><h2><ShieldCheck size={18}/>Verified employee ID notification</h2>
     {view.employee.status==="ok"?<><p>Policy: {view.employee.data.enabled?"Approved for new eligible source events":"Disabled"}</p>
       <p>Approved: {date(view.employee.data.approved_at)} · Effective: {date(view.employee.data.effective_from)}</p>
       <div className={styles.states}>
        {(["PENDING","SENDING","SENT","UNKNOWN","REJECTED"] as const).map(status=>
         <span key={status}>{status==="SENT"?"Provider accepted":status.toLowerCase()}: <strong>{count(view.employee.status==="ok"?view.employee.data.count_by_status?.[status]:null)}</strong></span>)}
       </div></>:<p role="status" className={styles.blocked}><LockKeyhole size={16}/>{view.employee.detail}</p>}
     <Link href="/office/settings">Review employee mail policy <ArrowRight size={16}/></Link>
    </section></div>
    {view.lifecycle.status==="ok"?<section className={styles.catalog}>
     <header><h2>Governed lifecycle event register</h2><span>{visible.length} of {policies.length} source records</span></header>
     <div className={styles.filters}>
      <label><Search size={16}/>Search event
       <input value={query} maxLength={100} onChange={e=>setQuery(e.target.value)}
        placeholder="Code, intent, subject, delivery owner"/></label>
      <label>Delivery authority<select value={owner} onChange={e=>setOwner(e.target.value)}>
       {owners.map(o=><option value={o} key={o}>{o==="ALL"?"All governed sources":o}</option>)}</select></label>
     </div>
     {visible.length?<div className={styles.list}>{visible.map(p=><article key={p.event_code}>
      <div><strong>{p.event_code} · {p.intent}</strong><small>{p.subject}</small></div>
      <dl><dt>Owner</dt><dd>{p.delivery_owner}</dd>
       <dt>Source verification</dt><dd>{p.source_ready?"Verified adapter":"Not verified"}</dd>
       <dt>Dispatch policy</dt><dd>{p.enabled?"Enabled with source gates":"Disabled"}</dd>
       <dt>Approval</dt><dd>{date(p.approved_at)}</dd></dl>
     </article>)}</div>:<p className={styles.state}>No approved policy records match these filters.</p>}
    </section>:null}
   <footer><ShieldCheck size={16}/>Provider acceptance is not inbox delivery. Unknown outcomes require source-led reconciliation. This screen is deliberately read-only and cannot change delivery policy.</footer>
  </>:null}
 </section>;
}
