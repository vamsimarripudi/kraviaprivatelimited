"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,Bell,CheckCheck,RefreshCw,Search,ShieldCheck,TriangleAlert} from "lucide-react";
import styles from "./office-connect-announcements.module.css";
type Announcement={id:string;title:string;body_text:string;announcement_type:string;
 audience_type:string;priority:string;status:string;requires_ack:boolean;
 published_at:string|null;expires_at:string|null;};
type Receipt={announcement_id:string;acknowledged_at:string|null;read_at?:string|null};
type Feed={announcements:Announcement[];announcement_receipts:Receipt[];
 capabilities:{announcement_read:boolean};detail?:string;};
const date=(value:string|null)=>value?new Date(value).toLocaleString("en-IN",{
 dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}):"Not recorded";
export function OfficeConnectAnnouncements(){
 const [data,setData]=useState<Feed|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [search,setSearch]=useState("");
 const [priority,setPriority]=useState("ALL");
 const [view,setView]=useState<"ALL"|"ACK">("ALL");
 useEffect(()=>{
  const ctrl=new AbortController();
  void (async()=>{
   try{
    const response=await fetch("/api/office-knowledge",{credentials:"same-origin",
     cache:"no-store",signal:ctrl.signal});
    const body=await response.json().catch(()=>({})) as Feed;
    if(!response.ok||!Array.isArray(body.announcements)||!Array.isArray(body.announcement_receipts))
     throw new Error(body.detail||"Authorized announcement source unavailable");
    if(!ctrl.signal.aborted){setData(body);setError("");}
   }catch(e){
    if(!ctrl.signal.aborted){setData(null);setError(e instanceof Error?e.message:"Announcement source unavailable");}
   }finally{if(!ctrl.signal.aborted)setLoading(false);}
  })();
  return()=>ctrl.abort();
 },[refresh]);
 const rows=useMemo(()=>data?.announcements.filter(row=>
  row.status==="PUBLISHED"&&(!row.expires_at||Date.parse(row.expires_at)>Date.now()))??[],[data]);
 const acknowledgements=useMemo(()=>new Set(
  data?.announcement_receipts.filter(r=>Boolean(r.acknowledged_at)).map(r=>r.announcement_id)??[],
 ),[data]);
 const visible=useMemo(()=>rows.filter(row=>{
  if(priority!=="ALL"&&row.priority!==priority)return false;
  if(view==="ACK"&&(!row.requires_ack||acknowledgements.has(row.id)))return false;
  const q=search.trim().toLowerCase();
  return !q||[row.title,row.body_text,row.announcement_type].some(value=>value.toLowerCase().includes(q));
 }),[rows,search,priority,view,acknowledgements]);
 async function acknowledge(row:Announcement){
  if(busy)return;
  setBusy(row.id);setError("");setNotice("");
  try{
   const response=await fetch("/api/office-knowledge",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"ANNOUNCEMENT_RECEIPT",announcement_id:row.id,acknowledged:true}),
   });
   const result=await response.json().catch(()=>({})) as {recorded?:boolean;detail?:string};
   if(!response.ok||result.recorded!==true)
    throw new Error(result.detail||"Acknowledgement was not confirmed");
   setNotice("Acknowledgement recorded in the authoritative Office Knowledge Hub.");
   setLoading(true);setRefresh(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:"Acknowledgement unavailable");}
  finally{setBusy(null);}
 }
 return <section className={styles.shell} aria-label="KRAVIA Connect company announcements">
  <Link href="/office/chat" className={styles.back}><ArrowLeft size={16}/>Connect</Link>
  <header className={styles.heading}><div><p className={styles.eyebrow}>KRAVIA CONNECT · VERIFIED PUBLICATIONS</p>
   <h1><Bell size={23}/>Company announcements</h1>
   <p>Only published communications assigned to your current Office audience. Acknowledgement is an explicit evidence action, not inferred consent.</p></div>
   <button type="button" disabled={loading||!!busy} onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>
    <RefreshCw size={16}/>Refresh</button></header>
  {notice?<p className={styles.notice} role="status"><ShieldCheck size={16}/>{notice}</p>:null}
  {error?<div className={styles.error} role="alert"><TriangleAlert size={17}/>{error}
   <button type="button" onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>Retry</button></div>:null}
  {loading?<p role="status" aria-busy="true" className={styles.state}>Checking current publication and role visibility…</p>:null}
  {!loading&&data?<><div className={styles.metrics}>
    <article><span>Current published items</span><strong>{rows.length}</strong></article>
    <article><span>Requiring my acknowledgement</span><strong>{rows.filter(r=>r.requires_ack&&!acknowledgements.has(r.id)).length}</strong></article>
    <article><span>High priority</span><strong>{rows.filter(r=>["HIGH","CRITICAL"].includes(r.priority)).length}</strong></article>
   </div>
   <div className={styles.filters}>
    <label><Search size={16}/>Search assigned announcements<input value={search} onChange={e=>setSearch(e.target.value)}
     maxLength={120} placeholder="Title, category or published message"/></label>
    <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}>
     <option value="ALL">All priorities</option>
     {["LOW","NORMAL","HIGH","CRITICAL"].map(p=><option key={p}>{p}</option>)}</select></label>
    <label>View<select value={view} onChange={e=>{
     const v=e.target.value;
     if(v==="ALL"||v==="ACK")setView(v);
    }}><option value="ALL">All visible</option><option value="ACK">Need acknowledgement</option></select></label>
   </div>
   <p role="status" className={styles.count}>{visible.length} authorized announcement(s) in this view</p>
   {visible.length?<div className={styles.cards}>{visible.map(row=><article key={row.id}>
     <header><span data-priority={row.priority}>{row.priority}</span>
      <small>{row.announcement_type} · Published {date(row.published_at)}</small></header>
     <h2>{row.title}</h2><p>{row.body_text}</p>
     <footer><span>{row.expires_at?"Expires "+date(row.expires_at):"No published expiry"}</span>
      {row.requires_ack?
       acknowledgements.has(row.id)?<span className={styles.acknowledged}><CheckCheck size={16}/>Acknowledged</span>:
       <button type="button" disabled={!!busy} onClick={()=>void acknowledge(row)}>
        <CheckCheck size={16}/>{busy===row.id?"Recording…":"Acknowledge publication"}</button>:
       <span>Informational publication</span>}
     </footer>
    </article>)}</div>:<p role="status" className={styles.state}>No currently authorized published announcements match these filters.</p>}
   <Link href="/office/knowledge" className={styles.source}>Open authoritative Knowledge Hub <ArrowRight size={16}/></Link>
  </>:null}
  <p className={styles.note}><ShieldCheck size={16}/>Read audiences, publication versions, expiry and receipts are enforced by the source Knowledge Hub. No external email is generated here.</p>
 </section>;
}
