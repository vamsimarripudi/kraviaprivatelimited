"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,LockKeyhole,RefreshCw,ShieldCheck} from "lucide-react";
import styles from "./office-connect-governance.module.css";
type Decision={allowed:boolean;source:string|null;scope_type:string|null;reason:string};
type Capability={code:string;label:string;company:Decision;own:Decision};
type Policy={code:string;active:boolean;high_risk:boolean;requires_managed_device:boolean;owner_bypass:boolean};
type Mapping={profile_code:string;permission_code:string;effect:string;default_scope_type:string};
type Payload={scope:string;generated_at:string;capabilities:Capability[];
 policies:Policy[];profile_mappings:Mapping[];disclaimer:string};
export function OfficeConnectGovernance(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 const [filter,setFilter]=useState("");
 useEffect(()=>{
  let active=true;
  void (async()=>{
   try{
    const response=await fetch("/api/office-chat/governance",{cache:"no-store",credentials:"same-origin"});
    const body=await response.json().catch(()=>({})) as Payload&{detail?:string};
    if(!response.ok)throw Error(body.detail||"Governance projection unavailable");
    if(body.scope!=="EXPLANATORY_READ_ONLY")throw Error("Unexpected policy scope");
    if(active){setData(body);setError("");}
   }catch(e){if(active){setError(e instanceof Error?e.message:"Governance unavailable");setData(null);}}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[refresh]);
 const caps=useMemo(()=>data?.capabilities.filter(row=>{
  const needle=filter.trim().toLowerCase();
  return !needle||(row.code+" "+row.label).toLowerCase().includes(needle);
 })??[],[data,filter]);
 const catalog=new Map(data?.policies.map(row=>[row.code,row])??[]);
 const mapping=data?.profile_mappings.filter(row=>caps.some(cap=>cap.code===row.permission_code))??[];
 return <section className={styles.shell} aria-label="KRAVIA Connect communication capability matrix">
  <Link href="/office/chat/admin" className={styles.back}><ArrowLeft size={16}/>Connect administration</Link>
  <header><div><p>GOVERNED ACCESS · CURRENT AUTHORITATIVE SOURCE</p>
   <h1>Communication access matrix</h1>
   <span>Live read-only IAM projection. Source permissions, active identity, device and record scope govern each operation.</span>
  </div><button type="button" disabled={loading} onClick={()=>{setLoading(true);setRefresh(n=>n+1);}}>
   <RefreshCw size={16}/>{loading?"Loading…":"Refresh"}</button></header>
  {loading?<p role="status" aria-busy="true">Checking explicit governance authority…</p>:null}
  {error?<div role="alert" className={styles.error}><LockKeyhole size={18}/><p>{error}</p></div>:null}
  {!loading&&!error&&data?<><div className={styles.status}><ShieldCheck size={17}/>
    Source-backed policy projection · {new Date(data.generated_at).toLocaleString("en-IN",
     {dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"})}</div>
   <label className={styles.filter}>Filter capabilities<input value={filter} maxLength={100}
    onChange={e=>setFilter(e.target.value)} placeholder="Permission code or business action"/></label>
   <div className={styles.tableWrap}><table>
    <caption>Effective authority for your session, evaluated separately for company and own-record scope</caption>
    <thead><tr><th scope="col">Capability</th><th scope="col">Company</th><th scope="col">Own</th>
      <th scope="col">Policy flags</th></tr></thead><tbody>
     {caps.map(cap=><tr key={cap.code}><th scope="row"><strong>{cap.label}</strong><small>{cap.code}</small></th>
      <td><span data-allowed={cap.company.allowed}>{cap.company.allowed?"Allowed":"Denied"}</span>
       <small>{cap.company.reason}</small></td>
      <td><span data-allowed={cap.own.allowed}>{cap.own.allowed?"Allowed":"Denied"}</span>
       <small>{cap.own.reason}</small></td>
      <td><small>{catalog.get(cap.code)?.high_risk?"High risk · ":""}
       {catalog.get(cap.code)?.requires_managed_device?"Managed device · ":""}
       {catalog.get(cap.code)?.active?"Active":"Not active"}</small></td>
     </tr>)}
    </tbody></table></div>
   <section className={styles.mappings}><h2>Source access-profile mapping</h2>
    <p>Profiles are not a substitute for active assignments, department ownership, MFA or explicit denies.</p>
    {!mapping.length?<p>No profile mappings are available in this scope.</p>:
     <div className={styles.tableWrap}><table><thead><tr><th scope="col">Source profile</th>
      <th scope="col">Permission</th><th scope="col">Effect</th><th scope="col">Default scope</th></tr></thead>
      <tbody>{mapping.map((row,index)=><tr key={row.profile_code+"|"+row.permission_code+"|"+index}>
       <td>{row.profile_code}</td><td>{row.permission_code}</td><td>{row.effect}</td>
       <td>{row.default_scope_type}</td>
      </tr>)}</tbody></table></div>}
   </section>
   <p className={styles.notice}>{data.disclaimer}</p>
   <nav className={styles.links}>
    <Link href="/office/access">Canonical access administration <ArrowRight size={16}/></Link>
    <Link href="/office/audit">Authorized audit explorer <ArrowRight size={16}/></Link>
    <Link href="/office/requests">Request policy review <ArrowRight size={16}/></Link>
   </nav>
  </>:null}
 </section>;
}
