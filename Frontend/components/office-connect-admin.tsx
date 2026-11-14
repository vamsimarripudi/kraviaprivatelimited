"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,CalendarClock,FileCheck2,FolderLock,LockKeyhole,
 Mail,RefreshCw,Route,ShieldCheck,SlidersHorizontal,UsersRound} from "lucide-react";
import styles from "./office-connect-admin.module.css";
type Channels={scope:"GOVERNED_CHANNEL_METADATA";generated_at:string;assignments_complete:boolean;
 departments:{department_code:string;channel_created:boolean;active_assignment_count:number|null;
 classification:string|null;state:string;}[];disclaimer:string};
type Retention={scope:"CANONICAL_RETENTION_READ";rules:{code:string}[];
 legal_holds:{id:string;status:string}[];completeness:{rules_truncated:boolean;holds_truncated:boolean}};
type Governance={scope:"EXPLANATORY_READ_ONLY";capabilities:{
 code:string;company:{allowed:boolean};own:{allowed:boolean}}[]};
type Data<T>={state:"loading"|"ok"|"restricted"|"unavailable";value?:T};
async function source<T>(url:string):Promise<Data<T>>{
 try{
  const response=await fetch(url,{cache:"no-store",credentials:"same-origin"});
  if(response.status===401||response.status===403)return {state:"restricted"};
  if(!response.ok)return {state:"unavailable"};
  return {state:"ok",value:await response.json() as T};
 }catch{return {state:"unavailable"};}
}
const modules=[
 {title:"Channels",description:"Current department membership sources and classification",
  href:"/office/chat/admin/channels",icon:UsersRound},
 {title:"Support queues",description:"Approved routing, staffing and fallback governance",
  href:"/office/chat/admin/queues",icon:Route},
 {title:"SLA policies",description:"Effective-dated deadline and escalation controls",
  href:"/office/chat/admin/sla",icon:CalendarClock},
 {title:"Retention & audit",description:"Canonical retention and preservation registers",
  href:"/office/chat/admin/retention",icon:FolderLock},
 {title:"Email & integrations",description:"Verified delivery, provider and customer-consent boundaries",
  href:"/office/chat/admin/integrations",icon:Mail},
 {title:"Communication permissions",description:"Live policy decisions and source mapping",
  href:"/office/chat/admin/permissions",icon:SlidersHorizontal},
];
export function OfficeConnectAdmin(){
 const [channels,setChannels]=useState<Data<Channels>>({state:"loading"});
 const [retention,setRetention]=useState<Data<Retention>>({state:"loading"});
 const [governance,setGovernance]=useState<Data<Governance>>({state:"loading"});
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let live=true;
  void Promise.all([
   source<Channels>("/api/office-chat/governance/channels"),
   source<Retention>("/api/office-chat/governance/retention"),
   source<Governance>("/api/office-chat/governance"),
  ]).then(([c,r,g])=>{
   if(!live)return;
   setChannels(c);setRetention(r);setGovernance(g);
  }).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[refresh]);
 const denied=channels.state==="restricted"&&governance.state==="restricted";
 const pending=loading||channels.state==="loading";
 const count=(state:Data<unknown>,value:number)=>
   loading?"…":state.state==="ok"?value.toLocaleString("en-IN"):"—";
 const total=channels.value?.departments.filter(row=>row.channel_created).length??0;
 const departments=channels.value?.departments.length??0;
 const retentionCount=retention.value?.rules.length??0;
 const metrics=[
  {label:"Provisioned department channels",value:count(channels,total),detail:"Existing source catalog only"},
  {label:"Department assignment scopes",value:count(channels,departments),detail:channels.value?.assignments_complete===false?"Source inventory truncated":"Verified assignment register"},
  {label:"Communication retention references",value:count(retention,retentionCount),detail:"Canonical privacy register only"},
 ];
 return <section className={styles.shell} aria-label="Connect administrative controls">
  <Link href="/office/chat" className={styles.back}><ArrowLeft size={16} aria-hidden="true"/>Connect</Link>
  <header><div><p className={styles.eyebrow}>KRAVIA CONNECT · ADMINISTRATION</p><h1>Communication governance</h1>
   <p>Governed policies, queue configuration and service integrations. Administration never creates access to private message content.</p></div>
   <button type="button" disabled={loading} onClick={()=>{setLoading(true);setRefresh(x=>x+1);}}>
    <RefreshCw size={16} aria-hidden="true"/>{loading?"Verifying…":"Refresh"}</button></header>
  {pending?<p className={styles.state} role="status" aria-busy="true">Checking current communication governance authority…</p>:null}
  {!loading&&denied?<div className={styles.blocked} role="alert"><LockKeyhole size={24}/>
    <h2>Communication administration is restricted</h2>
    <p>Independent administration or audit permission is required. The current account cannot enumerate company channels or policy configuration.</p>
    <Link href="/office/requests">Request formal access review <ArrowRight size={15}/></Link></div>:null}
  {!loading&&!denied?<><div className={styles.metrics}>
    {metrics.map(metric=><article key={metric.label}><h2>{metric.label}</h2>
      <strong>{metric.value}</strong><small>{metric.detail}</small></article>)}
   </div>
   {channels.state==="unavailable"?<p className={styles.state} role="alert">
      The channel source is temporarily unavailable. Counts are not estimated.</p>:null}
   <div className={styles.panel}><header><h2>Policy workspaces</h2>
      <span>Six governed modules</span></header>
    <nav className={styles.modules} aria-label="Communication governance modules">
     {modules.map(module=><Link href={module.href} key={module.href}>
      <module.icon size={21} aria-hidden="true"/><span><strong>{module.title}</strong><small>{module.description}</small></span>
      <ArrowRight size={17} aria-hidden="true"/></Link>)}
    </nav>
   </div>
   <div className={styles.two}>
    <section className={styles.panel}><h2>Authorization health</h2>
     {governance.state==="ok"&&governance.value?
      <p>{governance.value.capabilities.filter(row=>row.company.allowed).length} company-scope communication capabilities are granted to this verified session.
       Grant counts reflect current policy decisions, not ownership of every conversation.</p>:
      <p>Effective communication capability data is {governance.state}; no permission is inferred.</p>}
     <Link href="/office/chat/admin/permissions">Inspect source access matrix <ArrowRight size={16}/></Link>
    </section>
    <section className={styles.panel}><h2>Evidence and change control</h2>
     {retention.state==="ok"&&retention.value?
      <p>{retention.value.legal_holds.length} communication-scoped legal-hold entries in the bounded register.
       {retention.value.completeness.holds_truncated?" Source was truncated; review the full source.":""}</p>:
      <p>Retention and legal-hold information is {retention.state}. No absence of legal hold is assumed.</p>}
     <Link href="/office/requests">Submit governed policy proposal <ArrowRight size={16}/></Link>
     <Link href="/office/audit">Independent audit evidence <ArrowRight size={16}/></Link>
    </section>
   </div>
   <p className={styles.disclaimer}><ShieldCheck size={17} aria-hidden="true"/>
    Read-only source projections. Queue routing, external sends, retention execution, classifications and IAM changes require independently authorized workflows.</p>
  </>:null}
  <p className={styles.footer}><FileCheck2 size={16} aria-hidden="true"/>No private-message enumeration or implied authority from a job title.</p>
 </section>;
}
