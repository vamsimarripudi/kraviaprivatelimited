"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,Headset,LifeBuoy,RefreshCw,ShieldCheck} from "lucide-react";
import styles from "./office-connect-role-inbox.module.css";

export type RoleInboxKind="it"|"support";
type Row={id:string;title:string;status:string;priority:string;updated_at?:string;created_at?:string;ticket_code?:string;case_code?:string;subject?:string};
type Source={tickets?:Row[];cases?:Row[]};
function date(value:string|undefined){
 if(!value)return "";
 const t=new Date(value);
 return Number.isNaN(t.valueOf())?"":new Intl.DateTimeFormat("en-IN",
  {timeZone:"Asia/Kolkata",day:"numeric",month:"short"}).format(t);
}
export function OfficeConnectRoleInbox({kind}:{kind:RoleInboxKind}){
 const [rows,setRows]=useState<Row[]>([]);
 const [state,setState]=useState<"loading"|"ready"|"error">("loading");
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  const api=kind==="it"?"/api/office-it":"/api/office-support";
  void fetch(api,{credentials:"same-origin",cache:"no-store",signal:controller.signal})
   .then(async response=>{
    const result=await response.json().catch(()=>({})) as Source&{detail?:string};
    if(!response.ok)throw Error(response.status===403?"This ticket scope is not assigned.":result.detail??"Ticket inbox unavailable");
    const next=kind==="it"?result.tickets:result.cases;
    if(!Array.isArray(next))throw Error("Authorized ticket list unavailable");
    if(active){setRows(next);setState("ready");setError("");}
   }).catch(e=>{if(active){setRows([]);setState("error");setError(e instanceof Error?e.message:"Ticket source unavailable");}});
  return()=>{active=false;controller.abort();};
 },[kind,refresh]);
 const ordered=useMemo(()=>[...rows].sort((a,b)=>Date.parse(b.updated_at??b.created_at??"")-Date.parse(a.updated_at??a.created_at??"")).slice(0,150),[rows]);
 return <section className={styles.inbox} aria-label={kind==="it"?"Authorized IT ticket conversations":"Authorized support case conversations"}>
  <div className={styles.heading}>
   <span>{kind==="it"?<LifeBuoy size={17}/>:<Headset size={17}/>}
    {kind==="it"?"IT ticket chats":"Support case chats"}</span>
   <button type="button" aria-label="Refresh ticket conversations" title="Refresh"
    onClick={()=>{setState("loading");setRefresh(x=>x+1);}}><RefreshCw size={16}/></button>
  </div>
  {state==="loading"?<p className={styles.state} role="status">Verifying assigned ticket conversations…</p>:null}
  {state==="error"?<div className={styles.state} role="alert"><strong>Ticket source unavailable</strong><p>{error}</p>
    <button type="button" onClick={()=>{setState("loading");setRefresh(x=>x+1);}}>Retry</button></div>:null}
  {state==="ready"&&!ordered.length?<div className={styles.state} role="status">
    <ShieldCheck size={20}/><strong>No ticket conversations assigned</strong>
    <p>Only tickets visible through your current department permission are shown.</p>
  </div>:null}
  {state==="ready"?<nav className={styles.rows} aria-label="Ticket conversations">
   {ordered.map(item=>{
    const href=kind==="it"?"/office/chat/support/tickets/"+item.id:"/office/chat/support/cases/"+item.id;
    return <Link key={item.id} href={href}>
     <span className={styles.avatar} aria-hidden="true">{kind==="it"?"IT":"CS"}</span>
     <span className={styles.main}><strong>{kind==="it"?item.title:item.subject??item.title}</strong>
      <small>{kind==="it"?item.ticket_code:item.case_code} · {item.status.replaceAll("_"," ")}</small></span>
     <span className={styles.time}>{date(item.updated_at??item.created_at)}<ArrowUpRight size={14}/></span>
    </Link>;
   })}
  </nav>:null}
  <Link className={styles.source} href={kind==="it"?"/office/it":"/office/support"}>
    {kind==="it"?"Open IT desk":"Open Support work"} <ArrowUpRight size={14}/>
  </Link>
 </section>;
}
