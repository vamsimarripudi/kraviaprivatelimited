"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,FolderClosed,RefreshCw,ShieldCheck} from "lucide-react";
import styles from "./office-connect-governance.module.css";
type Channel={department_code:string;channel_created:boolean;channel_id:string|null;
 classification:string|null;state:string;active_assignment_count:number|null;updated_at:string|null};
type Data={scope:"GOVERNED_CHANNEL_METADATA";departments:Channel[];generated_at:string;
 assignments_complete:boolean;disclaimer:string};
export function OfficeConnectChannels(){
 const [data,setData]=useState<Data|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [filter,setFilter]=useState("");
 useEffect(()=>{
  let active=true;
  void (async()=>{
   try{
    const response=await fetch("/api/office-chat/governance/channels",
     {cache:"no-store",credentials:"same-origin"});
    const body=await response.json().catch(()=>({})) as Data&{detail?:string};
    if(!response.ok)throw new Error(body.detail||"Channel governance unavailable");
    if(body.scope!=="GOVERNED_CHANNEL_METADATA")throw new Error("Unexpected governance scope");
    if(active){setData(body);setError("");}
   }catch(e){if(active){setError(e instanceof Error?e.message:"Channel governance unavailable");setData(null);}}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[refresh]);
 const departments=useMemo(()=>data?.departments.filter(c=>
  c.department_code.toLowerCase().includes(filter.trim().toLowerCase()))??[],[data,filter]);
 return <section className={styles.shell} aria-label="KRAVIA Connect channel governance">
  <Link href="/office/chat/admin" className={styles.back}><ArrowLeft size={17}/>Connect administration</Link>
  <header><div><p>INDEPENDENT GOVERNANCE · SOURCE METADATA ONLY</p>
   <h1>Channel governance</h1>
   <span>Active job assignments and department channels. Membership and message access are separate.</span>
  </div><button type="button" disabled={loading} onClick={()=>{setLoading(true);setRefresh(n=>n+1);}}>
   <RefreshCw size={16}/>{loading?"Checking…":"Refresh"}</button></header>
  {loading?<p aria-busy="true" role="status">Verifying administrative scope and channel catalog…</p>:null}
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  {!loading&&!error&&data?<><div className={styles.status}>
    <ShieldCheck size={18}/>
    Read-only record inventory. {data.assignments_complete?"Current assignment totals":"Assignment totals withheld because the catalog is paginated"}.
   </div>
   <label className={styles.filter}>Filter department codes<input maxLength={80} value={filter}
    onChange={e=>setFilter(e.target.value)} placeholder="Find a department"/></label>
   {!departments.length?<div className={styles.notice}>No departments match the current filter.</div>:
    <div className={styles.tableWrap}><table><caption>
     Only department metadata is displayed. Confidential project groups and DMs are excluded.
    </caption><thead><tr><th scope="col">Department</th><th scope="col">Channel state</th>
     <th scope="col">Classification</th><th scope="col">Current assigned staff</th>
     <th scope="col">Source</th></tr></thead><tbody>
     {departments.map(channel=><tr key={channel.department_code}>
      <th scope="row"><FolderClosed size={16} aria-hidden="true"/> {channel.department_code}</th>
      <td>{channel.state}</td><td>{channel.classification??"Not assigned"}</td>
      <td>{channel.active_assignment_count===null?"Unavailable":channel.active_assignment_count}</td>
      <td>{channel.channel_created?<Link href={"/office/chat/channels/"+
       encodeURIComponent(channel.department_code)} title="Requires effective department membership">
       Open with current membership <ArrowRight size={14}/></Link>:
       "No provisioned channel"}</td>
     </tr>)}
    </tbody></table></div>}
   <section className={styles.mappings}><h2>Governed change process</h2>
    <p>{data.disclaimer}</p>
    <nav className={styles.links}>
     <Link href="/office/requests">Propose channel policy change <ArrowRight size={15}/></Link>
     <Link href="/office/access">Review canonical IAM <ArrowRight size={15}/></Link>
     <Link href="/office/audit">Review authorized audit events <ArrowRight size={15}/></Link>
    </nav>
   </section>
  </>:null}
 </section>;
}
