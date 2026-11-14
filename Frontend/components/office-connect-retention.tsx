"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,LockKeyhole,RefreshCw,ShieldCheck} from "lucide-react";
import styles from "./office-connect-governance.module.css";
type Rule={code:string;record_class:string;title:string;status:string;retention_period_text:string;
 retention_basis:string;effective_from:string|null;effective_to:string|null;reviewed_at:string|null};
type Hold={id:string;hold_code:string;title:string;status:string;scope_type:string;
 placed_at:string;released_at:string|null};
type Data={scope:"CANONICAL_RETENTION_READ";rules:Rule[];legal_holds:Hold[];
 completeness:{rules_truncated:boolean;holds_truncated:boolean};disclaimer:string;generated_at:string};
function show(value:string|null){
 if(!value)return "Not recorded";
 const n=Date.parse(value);
 return Number.isNaN(n)?"Unavailable":new Intl.DateTimeFormat("en-IN",
  {dateStyle:"medium",timeZone:"Asia/Kolkata"}).format(n);
}
export function OfficeConnectRetention(){
 const [data,setData]=useState<Data|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   try{
    const response=await fetch("/api/office-chat/governance/retention",
     {cache:"no-store",credentials:"same-origin"});
    const body=await response.json().catch(()=>({})) as Data&{detail?:string};
    if(!response.ok)throw new Error(body.detail||"Retention governance unavailable");
    if(body.scope!=="CANONICAL_RETENTION_READ")throw new Error("Unexpected register scope");
    if(active){setData(body);setError("");}
   }catch(e){if(active){setData(null);setError(e instanceof Error?e.message:"Register unavailable");}}
   finally{if(active)setLoading(false)}
  })();
  return()=>{active=false;};
 },[refresh]);
 return <section className={styles.shell} aria-label="Connect data retention and legal hold governance">
  <Link href="/office/chat/admin" className={styles.back}><ArrowLeft size={16}/>Connect administration</Link>
  <header><div><p>PRIVACY RETENTION · AUTHORITATIVE COMPANY REGISTER</p>
   <h1>Retention & legal holds</h1>
   <span>Approved retention references and preservation holds for communication records. Never an autonomous deletion control.</span>
  </div><button type="button" disabled={loading} onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>
   <RefreshCw size={16}/>{loading?"Checking…":"Refresh"}</button></header>
  {loading?<p role="status" aria-busy="true">Verifying canonical privacy-retention authority…</p>:null}
  {error?<div className={styles.error} role="alert"><LockKeyhole size={18}/>{error}</div>:null}
  {!loading&&!error&&data?<><div className={styles.status}><ShieldCheck size={17}/>
    Read-only canonical source · {show(data.generated_at)}
   </div><section className={styles.mappings}>
    <h2>Approved Connect-related retention references</h2>
    {data.rules.length?<div className={styles.tableWrap}><table>
     <caption>Only existing register records matching communication classifications are displayed.</caption>
     <thead><tr><th scope="col">Record class</th><th scope="col">Rule</th>
      <th scope="col">Period</th><th scope="col">Status</th><th scope="col">Effective</th></tr></thead>
     <tbody>{data.rules.map(rule=><tr key={rule.code}>
      <th scope="row"><strong>{rule.title}</strong><small>{rule.record_class} · {rule.code}</small></th>
      <td>{rule.retention_basis}</td><td>{rule.retention_period_text}</td>
      <td>{rule.status}</td><td>{show(rule.effective_from)}
       {rule.effective_to?"–"+show(rule.effective_to):""}</td>
     </tr>)}</tbody></table></div>:
     <p>No currently registered Connect-specific retention rule was found in the authorized source. Do not infer a default retention period.</p>}
   </section><section className={styles.mappings}>
    <h2>Communication-scoped legal holds</h2>
    {data.legal_holds.length?<div className={styles.tableWrap}><table>
      <thead><tr><th scope="col">Hold</th><th scope="col">Classification</th>
       <th scope="col">Status</th><th scope="col">Placed</th></tr></thead>
      <tbody>{data.legal_holds.map(hold=><tr key={hold.id}>
       <th scope="row">{hold.hold_code}<small>{hold.title}</small></th>
       <td>{hold.scope_type}</td><td>{hold.status}</td><td>{show(hold.placed_at)}</td>
      </tr>)}</tbody></table></div>:
     <p>No communication-scoped holds were visible in this authorized, bounded result.</p>}
   </section>
   {(data.completeness.rules_truncated||data.completeness.holds_truncated)?
     <div className={styles.notice}>Source results reached their safety limit. Open the canonical Privacy register for full records.</div>:null}
   <div className={styles.notice}><ShieldCheck size={16}/>{data.disclaimer}</div>
   <nav className={styles.links}>
    <Link href="/office/privacy">Canonical privacy register <ArrowRight size={15}/></Link>
    <Link href="/office/requests">Submit governed policy change request <ArrowRight size={15}/></Link>
    <Link href="/office/audit">Independent audit evidence <ArrowRight size={15}/></Link>
   </nav>
  </>:null}
 </section>;
}
