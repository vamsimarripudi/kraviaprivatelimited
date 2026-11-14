"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,BellRing,CheckCheck,Eye,EyeOff,RefreshCw,ShieldCheck} from "lucide-react";
import styles from "./office-connect-activity.module.css";
type Item={id:string;kind:string;status:string;created_at:string;read_at:string|null;request_id:string|null};
type Data={unread:number;notifications:Item[];detail?:string};
export function OfficeConnectActivity(){
 const [items,setItems]=useState<Item[]>([]);
 const [filter,setFilter]=useState<"ALL"|"UNREAD">("ALL");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [busy,setBusy]=useState<string|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  void (async()=>{
   try{
    const response=await fetch("/api/office-notifications",{
      credentials:"same-origin",cache:"no-store",signal:controller.signal});
    const body=await response.json().catch(()=>({})) as Data;
    if(!response.ok||!Array.isArray(body.notifications))
      throw new Error(body.detail||"Notification service unavailable");
    if(controller.signal.aborted)return;
    setItems(body.notifications);setError("");
   }catch(e){
    if(controller.signal.aborted)return;
    setError(e instanceof Error?e.message:"Notification source unavailable");setItems([]);
   }finally{if(!controller.signal.aborted)setLoading(false);}
  })();return()=>controller.abort();
 },[refresh]);
 const displayed=useMemo(()=>items.filter(item=>filter==="ALL"||item.status==="UNREAD"),[items,filter]);
 const unread=items.filter(item=>item.status==="UNREAD").length;
 async function mutate(action:"READ"|"UNREAD"|"DISMISS"|"READ_ALL",id?:string){
  setBusy(id??"ALL");setError("");setNotice("");
  try{
   const response=await fetch("/api/office-notifications",{
    method:"PATCH",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(action==="READ_ALL"?{action}:{action,notification_id:id})
   });
   const result=await response.json().catch(()=>({})) as {updated?:number;status?:string;detail?:string};
   if(!response.ok||(action==="READ_ALL"?typeof result.updated!=="number":typeof result.status!=="string"))
     throw new Error(result.detail||"Notification action not confirmed");
   setNotice(action==="READ_ALL"?String(result.updated)+" notifications marked read":"Status recorded by source");
   setLoading(true);setRefresh(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:"Notification action failed");}
  finally{setBusy(null);}
 }
 return <section className={styles.activity} aria-label="Connect notification activity">
  <Link className={styles.back} href="/office/chat"><ArrowLeft size={16}/>Connect</Link>
  <header className={styles.header}><div><p className={styles.eyebrow}>KRAVIA CONNECT · PRIVATE ACTIVITY</p>
   <h1>Activity & notifications</h1>
   <p>Only notifications assigned to your Office identity. Source titles are omitted to prevent disclosure after access revocation.</p></div>
   <button type="button" disabled={loading||!!busy} onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>
    <RefreshCw size={16}/>Refresh</button></header>
  <nav className={styles.toolbar} aria-label="Notification filters">
   <button type="button" aria-pressed={filter==="ALL"} onClick={()=>setFilter("ALL")}>All ({items.length})</button>
   <button type="button" aria-pressed={filter==="UNREAD"} onClick={()=>setFilter("UNREAD")}>Unread ({unread})</button>
   <button type="button" disabled={loading||!!busy||!unread} onClick={()=>void mutate("READ_ALL")}>
    <CheckCheck size={16}/>Mark all read</button>
  </nav>
  {notice?<p role="status" className={styles.notice}>{notice}</p>:null}
  {error?<div role="alert" className={styles.error}><span>{error}</span>
   <button type="button" onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>Retry</button></div>:null}
  {loading?<p role="status" className={styles.empty}>Loading current actor notifications…</p>:null}
  {!loading&&!error&&!displayed.length?<p className={styles.empty}>No {filter==="ALL"?"current":"unread"} notifications.</p>:null}
  {!loading&&!error?<ol className={styles.list}>{displayed.map(item=><li key={item.id}>
   <BellRing size={18} aria-hidden="true"/>
   <div><strong>{item.kind.replaceAll("_"," ").toLowerCase()} notification</strong>
    <small>{new Date(item.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})} · {item.status}</small>
    <p>Open the canonical Office notification center for current source-authorized details.</p></div>
   <div className={styles.actions}>
    <Link href="/office/notifications"><ArrowRight size={15}/>Open source</Link>
    <button type="button" disabled={!!busy} onClick={()=>void mutate(item.status==="UNREAD"?"READ":"UNREAD",item.id)}>
     {item.status==="UNREAD"?<Eye size={15}/>:<EyeOff size={15}/>}
     {item.status==="UNREAD"?"Mark read":"Mark unread"}</button>
    <button type="button" disabled={!!busy} onClick={()=>void mutate("DISMISS",item.id)}>Dismiss</button>
   </div>
  </li>)}</ol>:null}
  <footer><ShieldCheck size={16}/>Activity does not grant access to restricted source records.</footer>
 </section>;
}
