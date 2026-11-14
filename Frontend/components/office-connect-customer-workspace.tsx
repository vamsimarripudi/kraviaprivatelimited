"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,BarChart3,Clock3,Headphones,LockKeyhole,RefreshCw,ShieldCheck} from "lucide-react";
import {summarizeSupportCases,type SupportPeriod} from "@/lib/office/connect-support-insights";
import styles from "./office-connect-customer-workspace.module.css";
type CaseEvent={id:string;event_type:string;created_at:string};
type Case={id:string;case_code:string;customer_id?:string|null;subject:string;
 description:string;category:string;source:string;priority:string;status:string;
 created_at:string;updated_at:string;resolved_at?:string|null;due_at?:string|null;events:CaseEvent[]};
type Customer={id:string;display_name?:string|null;legal_name?:string|null};
type Payload={actor:{user_id:string};scope:{type?:string|null;key?:string|null};
 can_manage:boolean;cases:Case[];customers:Customer[];disclaimer:string};
const closed=new Set(["RESOLVED","CLOSED"]);
function format(value?:string|null){
 if(!value)return "Not recorded";
 const parsed=Date.parse(value);
 return Number.isFinite(parsed)?new Intl.DateTimeFormat("en-IN",
  {dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(parsed):"Not available";
}
const periodOptions=[{value:"7",label:"7 days"},{value:"30",label:"30 days"},
 {value:"90",label:"90 days"},{value:"all",label:"All visible records"}];
export function OfficeConnectCustomerWorkspace({mode}:{mode:"customers"|"analytics"}){
 const [data,setData]=useState<Payload|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [query,setQuery]=useState("");
 const [status,setStatus]=useState("all");
 const [selected,setSelected]=useState<string|null>(null);
 const [period,setPeriod]=useState("30");
 useEffect(()=>{
  let active=true;
  void fetch("/api/office-support",{credentials:"same-origin",cache:"no-store"})
   .then(async response=>{
    const value=await response.json().catch(()=>({})) as Payload&{detail?:string};
    if(!response.ok||!Array.isArray(value.cases))throw Error(value.detail||"Customer Support source unavailable");
    return value;
   }).then(value=>{if(active){setData(value);setError("");}})
   .catch(e=>{if(active){setData(null);setError(e instanceof Error?e.message:"Customer cases unavailable");}})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[refresh]);
 const filtered=useMemo(()=>{
  const needle=query.trim().toLowerCase();
  return (data?.cases??[]).filter(item=>(status==="all"||item.status===status)&&
    (!needle||[item.case_code,item.subject,item.category,item.status].join(" ").toLowerCase().includes(needle)));
 },[data,query,status]);
 const current=selected?filtered.find(item=>item.id===selected):null;
 const customers=new Map((data?.customers??[]).map(row=>[row.id,row]));
 // A source page is bounded at 400 cases; never present a partial result as a
 // complete or company-wide business metric.
 const now=Date.now();
 const insights=mode==="analytics"?summarizeSupportCases(data?.cases??[],
  period==="all"?null:Number(period) as SupportPeriod,now):null;
 const maxWeek=Math.max(1,...(insights?.weekly??[]).map(row=>row.count));
 const maxCategory=Math.max(1,...(insights?.categories??[]).map(row=>row.count));
 return <section className={styles.shell} aria-label={mode==="analytics"?"Customer Support analytics":"Customer correspondence"}>
  <Link href="/office/chat/support" className={styles.back}><ArrowLeft size={16} aria-hidden="true"/>Support home</Link>
  <header><div><p className={styles.eyebrow}>KRAVIA CONNECT · CANONICAL CUSTOMER SUPPORT</p>
   <h1>{mode==="analytics"?"Support analytics":"Customer correspondence"}</h1>
   <p>{mode==="analytics"?
     "Aggregated authorized case demand. Never employee surveillance, a fabricated SLA target or unrestricted customer reporting.":
     "Authorized case view. Customer-visible replies and private internal notes require separate delivery and source approvals."}</p>
   </div><button type="button" disabled={loading} onClick={()=>{setLoading(true);setRefresh(x=>x+1);}}>
    <RefreshCw size={16} aria-hidden="true"/>{loading?"Loading…":"Refresh"}</button></header>
  {loading?<p role="status" aria-busy="true" className={styles.state}>Checking current Customer Support scope…</p>:null}
  {error?<div role="alert" className={styles.restricted}><LockKeyhole size={19} aria-hidden="true"/>
    <p>{error}. Source records are not disclosed.</p>
    <Link href="/office/requests">Request authorized access</Link></div>:null}
  {!loading&&!error&&data?<><p className={styles.notice}><ShieldCheck size={16} aria-hidden="true"/>
   Scope {data.scope.type??"Current authorized user"}{data.scope.key?" · "+data.scope.key:""}
   {data.cases.length>=400?" · The 400-case source limit was reached; this result may be incomplete.":""}
  </p>
  {mode==="analytics"&&insights?<><div className={styles.toolbar}>
   <label>Reporting period<select value={period} onChange={event=>setPeriod(event.target.value)}>
    {periodOptions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
   </select></label></div>
   <div className={styles.stats}>
    <article><strong>{insights.count}</strong><span>Visible cases in period</span></article>
    <article><strong>{insights.active}</strong><span>Active cases</span></article>
    <article><strong>{insights.overdue}</strong><span>Open with recorded overdue dates</span></article>
    <article><strong>{insights.median_resolution_hours===null?"—":insights.median_resolution_hours.toFixed(1)+" h"}</strong>
     <span>Median resolution · {insights.resolution_samples} eligible records</span></article>
   </div>
   <div className={styles.columns}>
    <section className={styles.panel}><h2><BarChart3 size={18} aria-hidden="true"/> Weekly case intake</h2>
     <p>Eight calendar weeks. Bars reflect cases in your current permitted data and selected reporting period.</p>
     <div className={styles.bars} role="img" aria-label="Eight-week authorized customer case intake">
      {insights.weekly.map(row=><div key={row.start} className={styles.barItem}>
       <strong>{row.count}</strong><span style={{height:(Math.max(3,row.count/maxWeek*100))+"%"}}/>
       <small>{row.start.slice(5)}</small></div>)}
     </div>
    </section>
    <section className={styles.panel}><h2>Service categories</h2>
     {insights.categories.length?<ol className={styles.categories}>
      {insights.categories.map(row=><li key={row.name}><div><strong>{row.name}</strong>
        <span>{row.count} case(s)</span></div>
        <span className={styles.track}><span style={{width:(row.count/maxCategory*100)+"%"}}/></span>
      </li>)}</ol>:<p>No cases in the requested authorized period.</p>}
    </section>
   </div>
   <p className={styles.notice}>This is a bounded operational aggregate. An absent due date does not imply SLA compliance or failure. No customer, employee or payment records are exported.</p>
  </>:null}
  {mode==="customers"?<div className={styles.columns}>
   <section className={styles.panel}><h2>Authorized case list</h2>
    <div className={styles.toolbar}>
     <label>Search cases<input value={query} onChange={event=>setQuery(event.target.value)}
       placeholder="Code, subject, category…" maxLength={100}/></label>
     <label>Case status<select value={status} onChange={event=>setStatus(event.target.value)}>
      <option value="all">All statuses</option>
      {["OPEN","IN_PROGRESS","WAITING_CUSTOMER","RESOLVED","CLOSED"].map(value=>
        <option key={value}>{value}</option>)}</select></label>
    </div>
    {filtered.length?<div className={styles.caseList}>{filtered.map(item=>
     <button type="button" key={item.id} aria-pressed={selected===item.id}
       data-selected={selected===item.id} onClick={()=>setSelected(item.id)}>
      <span><strong>{item.subject}</strong><small>{item.case_code} · {item.priority} · {item.status}</small></span>
      <ArrowRight size={16} aria-hidden="true"/></button>)}</div>:
      <p className={styles.empty}>No permitted customer cases match these filters.</p>}
   </section>
   <section className={styles.panel}>
    <h2>Case inspector</h2>
    {current?<><h3>{current.subject}</h3>
      <p>{current.case_code} · {current.priority} · {current.status}</p>
      <dl><dt>Customer reference</dt><dd>{current.customer_id?
        customers.get(current.customer_id)?.display_name??
        customers.get(current.customer_id)?.legal_name??"Authorized customer":"Internal or unlinked"}</dd>
       <dt>Category</dt><dd>{current.category}</dd>
       <dt>Source</dt><dd>{current.source}</dd>
       <dt>Last updated</dt><dd>{format(current.updated_at)}</dd>
       <dt>Recorded deadline</dt><dd>{format(current.due_at)}</dd>
      </dl>
      <h3>Source case summary</h3><p className={styles.bodyText}>{current.description}</p>
      <h3>Internal workflow timeline</h3>
      {current.events.length?<ol className={styles.events}>{current.events.map(event=>
       <li key={event.id}><Clock3 size={15} aria-hidden="true"/>
        <span><strong>{event.event_type.replaceAll("_"," ")}</strong>
        <small>{format(event.created_at)}</small></span></li>)}</ol>:
       <p>No accessible workflow events.</p>}
      <p className={styles.notice}>Event notes are withheld here because the source does not classify them as customer-visible versus investigator-only. External email is never sent from this view.</p>
      <Link href="/office/support" className={styles.source}>Manage in canonical Customer Support <ArrowRight size={16}/></Link>
     </>:<p className={styles.empty}>Choose a case to inspect source-authorized metadata.</p>}
   </section>
  </div>:null}
  <footer className={styles.footer}><ShieldCheck size={16} aria-hidden="true"/>
   Customer-facing mail, refunds and role changes require independent canonical approvals and verified delivery.</footer>
 </>:null}
 </section>;
}
