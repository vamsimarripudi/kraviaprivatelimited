"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,Bot,FileCheck2,LockKeyhole,RefreshCw,ShieldCheck,TriangleAlert} from "lucide-react";
import styles from "./office-connect-ai-workspace.module.css";
type Tool={id:string;tool_code:string;tool_name:string;provider_name:string;
 external_service:boolean;allowed_data_classes:string[];prohibited_data_classes:string[];
 retention_policy:string;provider_training_policy:string;status:string;human_review_required:boolean;
 expires_on:string|null};
type Use={id:string;use_case_code:string;requester_user_id:string;tool_id:string;
 title:string;status:string;action_mode:string;intended_data_classes:string[];
 human_review_required:boolean;expires_at:string|null;created_at:string};
type Model={actor:{user_id:string};capabilities:{use_read:boolean;use_request:boolean};
 tools:Tool[];use_cases:Use[];disclaimer:string;detail?:string};
function date(iso:string|null){
 if(!iso)return "Not recorded";
 const d=new Date(iso);
 return Number.isNaN(d.getTime())?"Unavailable":
  d.toLocaleDateString("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"});
}
export function OfficeConnectAiWorkspace(){
 const [model,setModel]=useState<Model|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [tab,setTab]=useState<"TOOLS"|"REQUESTS">("TOOLS");
 useEffect(()=>{
  const controller=new AbortController();
  void (async()=>{
   try{
    const response=await fetch("/api/office-ai-governance",{
     credentials:"same-origin",cache:"no-store",signal:controller.signal});
    const body=await response.json().catch(()=>({})) as Model;
    if(!response.ok||!body.actor?.user_id||!Array.isArray(body.tools)||!Array.isArray(body.use_cases))
     throw new Error(response.status===403?"AI governance access is not assigned":body.detail||"AI registry is unavailable");
    if(!controller.signal.aborted){setModel(body);setError("");}
   }catch(e){
    if(!controller.signal.aborted){setModel(null);
     setError(e instanceof Error?e.message:"AI registry unavailable");}
   }finally{if(!controller.signal.aborted)setLoading(false);}
  })();return()=>controller.abort();
 },[refresh]);
 const tools=useMemo(()=>(model?.tools??[]).filter(item=>item.status==="APPROVED"&&
   (!item.expires_on||Date.parse(item.expires_on+"T23:59:59Z")>Date.now())),[model]);
 const mine=useMemo(()=>(model?.use_cases??[]).filter(item=>
  item.requester_user_id===model?.actor.user_id),[model]);
 return <section className={styles.shell} aria-label="Connect AI use policy">
  <Link href="/office/chat" className={styles.back}><ArrowLeft size={16}/>Connect</Link>
  <header className={styles.head}>
   <div><p className={styles.eyebrow}>KRAVIA CONNECT · HUMAN APPROVAL FIRST</p>
    <h1>AI use & governance</h1>
    <p>This is a permission-scoped registry of approved tools and your own use requests—not an AI chat provider. No prompts, employee records or company documents are transmitted.</p></div>
   <button type="button" disabled={loading} onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>
    <RefreshCw size={16}/>Refresh policy</button>
  </header>
  <div className={styles.boundary}><LockKeyhole size={19}/><div><strong>Data stays within its governed source</strong>
   <p>Approval to use a tool does not authorize access to unrelated HR, Finance, legal, customer or private Connect records. A separate human review is required where policy mandates it.</p></div></div>
  {loading?<p role="status" aria-busy="true" className={styles.state}>Verifying current AI policy and approved providers…</p>:null}
  {error?<div role="alert" className={styles.error}><TriangleAlert size={18}/>{error}
    <button type="button" onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>Retry</button></div>:null}
  {!loading&&model&&!error?<><div className={styles.metrics}>
   <article><span>Current approved tools</span><strong>{tools.length}</strong></article>
   <article><span>My use requests</span><strong>{mine.length}</strong></article>
   <article><span>My approved uses</span><strong>{mine.filter(u=>u.status==="APPROVED").length}</strong></article>
  </div>
  <div role="group" aria-label="AI registry views" className={styles.tabs}>
   <button type="button" aria-pressed={tab==="TOOLS"} onClick={()=>setTab("TOOLS")}>Approved providers</button>
   <button type="button" aria-pressed={tab==="REQUESTS"} onClick={()=>setTab("REQUESTS")}>My requests</button>
   <Link href="/office/ai">Open authoritative governance <ArrowRight size={16}/></Link>
  </div>
  {tab==="TOOLS"?<div className={styles.cards}>{tools.map(tool=><article key={tool.id}>
   <header><Bot size={19}/><div><strong>{tool.tool_name}</strong><small>{tool.tool_code} · {tool.provider_name}</small></div></header>
   <dl><dt>Delivery boundary</dt><dd>{tool.external_service?"External approved provider":"Internal approved tool"}</dd>
    <dt>Allowed classes</dt><dd>{tool.allowed_data_classes.join(", ")||"No classified data"}</dd>
    <dt>Prohibited classes</dt><dd>{tool.prohibited_data_classes.join(", ")||"None listed in registry"}</dd>
    <dt>Training policy</dt><dd>{tool.provider_training_policy}</dd>
    <dt>Retention policy</dt><dd>{tool.retention_policy}</dd>
    <dt>Human review</dt><dd>{tool.human_review_required?"Required":"Policy-dependent"}</dd>
    <dt>Expires</dt><dd>{date(tool.expires_on)}</dd></dl>
  </article>)}</div>:<div className={styles.cards}>{mine.map(u=><article key={u.id}>
   <header><FileCheck2 size={19}/><div><strong>{u.title}</strong><small>{u.use_case_code} · {u.status}</small></div></header>
   <dl><dt>Requested action</dt><dd>{u.action_mode.replaceAll("_"," ")}</dd>
    <dt>Intended classes</dt><dd>{u.intended_data_classes.join(", ")||"No classified data"}</dd>
    <dt>Human review</dt><dd>{u.human_review_required?"Required":"Not mandated"}</dd>
    <dt>Expires</dt><dd>{date(u.expires_at)}</dd>
    <dt>Created</dt><dd>{date(u.created_at)}</dd></dl>
  </article>)}</div>}
  {(tab==="TOOLS"?tools.length:mine.length)===0?
   <p role="status" className={styles.state}>{tab==="TOOLS"?"No currently approved tools are visible to your identity.":"No personal AI use requests are recorded."}</p>:null}
  <footer><ShieldCheck size={16}/>This view does not create an external provider session or change source permissions. Requests and reviews remain within Office AI Governance.</footer>
  </>:null}
 </section>;
}
