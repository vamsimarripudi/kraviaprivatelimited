"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,CalendarClock,LockKeyhole,RefreshCw,Route,ShieldCheck,TriangleAlert} from "lucide-react";
import {dueQueue,queueGroups,terminalIt,terminalSupport,type QueueCase} from "@/lib/office/connect-queue-summary";
import styles from "./office-connect-service-governance.module.css";
type ItTicket=QueueCase&{ticket_code:string;title:string};
type SupportCase=QueueCase&{case_code:string;subject:string};
type IT={tickets:ItTicket[];capabilities:{manage:boolean;read_company:boolean};actor:{user_id:string}};
type Support={cases:SupportCase[];scope:{source?:string|null;type?:string|null;key?:string|null};can_manage:boolean};
type Source<T>={state:"loading"|"ok"|"restricted"|"unavailable";value?:T};
async function source<T>(url:string):Promise<Source<T>>{
 try{
  const res=await fetch(url,{cache:"no-store",credentials:"same-origin"});
  if(res.status===401||res.status===403)return {state:"restricted"};
  if(!res.ok)return {state:"unavailable"};
  return {state:"ok",value:await res.json() as T};
 }catch{return {state:"unavailable"};}
}
function stamp(value:string){
 const ms=Date.parse(value);
 return Number.isFinite(ms)?new Intl.DateTimeFormat("en-IN",
  {dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(ms):"Unavailable";
}
export function OfficeConnectServiceGovernance({mode}:{mode:"queues"|"sla"}){
 const [it,setIt]=useState<Source<IT>>({state:"loading"});
 const [support,setSupport]=useState<Source<Support>>({state:"loading"});
 const [now,setNow]=useState<number|null>(null);
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let live=true;
  void Promise.all([source<IT>("/api/office-it"),source<Support>("/api/office-support")])
    .then(([i,s])=>{if(live){setIt(i);setSupport(s);setNow(Date.now());}})
    .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[refresh]);
 const clock=now??0;
 const itRows=it.value?.tickets??[];
 const supportRows=support.value?.cases??[];
 const itGroups=queueGroups(itRows,terminalIt,clock);
 const supportGroups=queueGroups(supportRows,terminalSupport,clock);
 const itDue=dueQueue(itRows,terminalIt,clock);
 const supportDue=dueQueue(supportRows,terminalSupport,clock);
 function groupTable(groups:ReturnType<typeof queueGroups>){
  return <div className={styles.tableWrap}><table><thead><tr>
    <th scope="col">Source category</th><th scope="col">Visible records</th><th scope="col">Active</th>
    <th scope="col">Unassigned</th><th scope="col">Urgent</th><th scope="col">Past due</th>
   </tr></thead><tbody>{groups.map(row=><tr key={row.name}><th scope="row">{row.name}</th>
    <td>{row.total}</td><td>{row.active}</td><td>{row.unassigned}</td><td>{row.urgent}</td><td>{row.overdue}</td>
   </tr>)}</tbody></table></div>;
 }
 const serviceEntries=[
  {key:"IT",source:it,groups:itGroups,due:itDue,limit:500,href:"/office/it",link:"Open IT service"},
  {key:"Customer Support",source:support,groups:supportGroups,due:supportDue,
   limit:400,href:"/office/support",link:"Open Customer Support"},
 ];
 return <section className={styles.shell} aria-label={mode==="queues"?"Connect queue governance":"Connect SLA deadline review"}>
  <Link className={styles.back} href="/office/chat/admin"><ArrowLeft size={16} aria-hidden="true"/>Administration</Link>
  <header><div><p className={styles.eyebrow}>KRAVIA CONNECT · CANONICAL SERVICE SOURCES</p>
   <h1>{mode==="queues"?"Support queue governance":"SLA & deadline review"}</h1>
   <p>{mode==="queues"?"Current authorized queue and ownership inventory. Routing changes must be approved in the canonical service.":
   "Only explicitly recorded ticket deadlines appear. Absence of a due date is not evidence of SLA compliance or breach."}</p>
  </div><button type="button" disabled={loading}
   onClick={()=>{setLoading(true);setRefresh(x=>x+1);}}><RefreshCw size={16}/>{loading?"Loading…":"Refresh"}</button></header>
  {loading?<p className={styles.state} role="status" aria-busy="true">Verifying your service permissions…</p>:null}
  {!loading?<div className={styles.sections}>{serviceEntries.map(entry=><section key={entry.key} className={styles.panel}>
   <header><h2>{mode==="queues"?<Route size={18} aria-hidden="true"/>:<CalendarClock size={18} aria-hidden="true"/>}
    {entry.key}</h2><span>Canonical source</span></header>
   {entry.source.state!=="ok"?<div className={styles.empty} role="status"><LockKeyhole size={18} aria-hidden="true"/>
    {entry.source.state==="restricted"?"Not assigned to this source authority":"Source temporarily unavailable"}.
    No restricted records or inferred counts.</div>:<>
    <p>Results are limited to your current source permissions.
     {((entry.key==="IT"?itRows.length:supportRows.length)>=entry.limit)?" The source limit was reached; this table may be incomplete.":""}
    </p>
    {mode==="queues"?
     entry.groups.length?groupTable(entry.groups):<div className={styles.empty}>No authorized queue records.</div>:
     entry.due.length?<div className={styles.deadlines}>{entry.due.slice(0,40).map(ticket=>
      <article key={ticket.id} data-past-due={ticket.dueState==="PAST DUE"}>
       <TriangleAlert size={17} aria-hidden="true"/>
       <div><strong>{"title" in ticket?String(ticket.title):"subject" in ticket?String(ticket.subject):"Service ticket"}</strong>
        <small>{ticket.category} · {ticket.status} · {ticket.priority}</small>
       </div><span>{ticket.dueState==="PAST DUE"?"Past recorded deadline · ":"Recorded deadline · "}
        {stamp(ticket.due_at!)}</span></article>)}</div>:
      <div className={styles.empty}>No active accessible cases with recorded due dates. No SLA outcome is inferred.</div>}
    {mode==="sla"?<small>Showing up to 40 nearest due dates from the bounded authorized source.</small>:null}
    <Link href={entry.href}>{entry.link} <ArrowRight size={15} aria-hidden="true"/></Link>
   </>}
  </section>)}</div>:null}
  <p className={styles.notice}><ShieldCheck size={16} aria-hidden="true"/>
   This workspace cannot alter service-level agreements, reroute cases, send customer mail or change IAM.
   Those changes require independent approved Office workflows.</p>
  <Link href="/office/requests" className={styles.policy}>Submit governed change request <ArrowRight size={15}/></Link>
 </section>;
}
