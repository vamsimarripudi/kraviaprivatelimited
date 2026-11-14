"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,BellRing,CheckCheck,ClipboardCheck,Headphones,MessageCircle,RefreshCw,ShieldCheck,TriangleAlert} from "lucide-react";
import styles from "./office-connect-activity.module.css";
type Notification={id:string;request_id:string|null;kind:string;title:string;body:string;status:string;created_at:string;read_at:string|null};
type Mention={id:string;body:string;sender_name:string;created_at:string;read_at:string|null};
type Escalation={id:string;recipient_user_id:string;status:string;level:number;created_at:string;
 source_ticket?:{title?:string}|null};
type Result<T>={state:"ok"|"restricted"|"unavailable";value?:T};
type Source={notifications:Result<{notifications:Notification[]}>;mentions:Result<{messages:Mention[]}>;
 escalations:Result<{actor_user_id:string;items:Escalation[]}>};
type Kind="ALL"|"UNREAD"|"MENTIONS"|"TICKETS"|"APPROVALS";
type Item={id:string;source:"notification"|"mention"|"escalation";title:string;detail:string;
 kind:string;at:string;status:string;href:string;actionable:boolean};
async function source<T>(url:string):Promise<Result<T>>{
 try{
  const response=await fetch(url,{cache:"no-store",credentials:"same-origin"});
  if([401,403].includes(response.status))return {state:"restricted"};
  const body=await response.json().catch(()=>({})) as T;
  if(!response.ok)return {state:"unavailable"};
  return {state:"ok",value:body};
 }catch{return {state:"unavailable"};}
}
function when(value:string){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?"Time unknown":new Intl.DateTimeFormat("en-IN",{
  day:"numeric",month:"short",hour:"numeric",minute:"2-digit",timeZone:"Asia/Kolkata"
 }).format(date);
}
const initial:Source={
 notifications:{state:"unavailable"},mentions:{state:"unavailable"},escalations:{state:"unavailable"}
};
function notificationKind(value:string):Kind{
 const word=value.toUpperCase();
 if(word.includes("APPROV")||word.includes("DECISION")||word.includes("REQUEST"))return "APPROVALS";
 if(word.includes("TICKET")||word.includes("SERVICE")||word.includes("ESCALAT")||word.includes("IT_"))return "TICKETS";
 return "ALL";
}
export function OfficeConnectActivity(){
 const [sources,setSources]=useState<Source>(initial);
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 const [filter,setFilter]=useState<Kind>("ALL");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState("");
 useEffect(()=>{
  let live=true;
  void Promise.all([
   source<{notifications:Notification[]}>("/api/office-notifications"),
   source<{messages:Mention[]}>("/api/office-chat/mentions"),
   source<{actor_user_id:string;items:Escalation[]}>("/api/office-chat/support/escalations")
  ]).then(([notifications,mentions,escalations])=>{
   if(live){setSources({notifications,mentions,escalations});setError("");}
  }).catch(()=>{
   if(live)setError("Could not load the current activity sources");
  }).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[refresh]);
 const all=useMemo<Item[]>(()=>{
  const notifications=(sources.notifications.value?.notifications??[]).map(n=>({
   id:n.id,source:"notification" as const,title:n.title,detail:n.body,
   kind:notificationKind(n.kind),at:n.created_at,
   status:n.status,href:n.request_id?"/office/requests":"/office/notifications",
   actionable:n.status==="UNREAD",
  }));
  const mentions=(sources.mentions.value?.messages??[]).map(m=>({
   id:m.id,source:"mention" as const,title:"Mentioned by "+m.sender_name,
   detail:m.body,kind:"MENTIONS",at:m.created_at,
   status:m.read_at?"READ":"UNREAD",href:"/office/chat/threads/"+m.id,
   actionable:!m.read_at,
  }));
  const escalations=(sources.escalations.value?.items??[])
   .filter(e=>e.recipient_user_id===sources.escalations.value?.actor_user_id)
   .map(e=>({id:e.id,source:"escalation" as const,
    title:e.source_ticket?.title??"Assigned IT escalation",
    detail:"Level "+e.level+" · "+e.status,kind:"TICKETS",at:e.created_at,
    status:e.status==="PENDING"?"UNREAD":"READ",
    href:"/office/chat/support/escalations/"+e.id,actionable:false,
   }));
  return [...notifications,...mentions,...escalations]
   .sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,250);
 },[sources]);
 const shown=useMemo(()=>all.filter(item=>{
  if(filter==="ALL")return true;
  if(filter==="UNREAD")return item.status==="UNREAD";
  return item.kind===filter;
 }),[all,filter]);
 async function mutation(url:string,action:Record<string,string>){
  setBusy(url+JSON.stringify(action));setError("");setNotice("");
  try{
   const response=await fetch(url,{method:"PATCH",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(action)});
   const body=await response.json().catch(()=>({})) as {detail?:string};
   if(!response.ok)throw new Error(body.detail||"Action was not confirmed");
   setNotice("Current source recorded the read state.");
   setLoading(true);setRefresh(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:"Read state unavailable")}
  finally{setBusy("");}
 }
 const sourceStatus=[
  {label:"Personal notifications",state:sources.notifications.state},
  {label:"Private mentions",state:sources.mentions.state},
  {label:"Assigned escalations",state:sources.escalations.state},
 ];
 const hasNotifications=sources.notifications.state==="ok";
 return <section className={styles.shell} aria-label="Connect personal activity">
  <Link href="/office/chat" className={styles.back}><ArrowLeft size={17}/>Connect</Link>
  <header className={styles.header}><div><p>KRAVIA CONNECT · ATTENTION CENTER</p>
   <h1>Activity & notifications</h1>
   <span>Personal notifications, private mentions and assigned IT escalation evidence.</span>
  </div><div className={styles.actions}><button type="button" disabled={loading} onClick={()=>{
   setLoading(true);setRefresh(v=>v+1);}}><RefreshCw size={16}/>Refresh</button>
   <Link href="/office/settings">Notification settings <ArrowRight size={15}/></Link></div></header>
  <div className={styles.sourceStatuses} aria-live="polite">
   {sourceStatus.map(row=><span key={row.label}><ShieldCheck size={14}/>
     {row.label}: {loading?"checking":row.state}</span>)}
  </div>
  <div className={styles.toolbar}><div role="group" aria-label="Filter activity">
   {(["ALL","UNREAD","MENTIONS","TICKETS","APPROVALS"] as const).map(item=>
    <button type="button" key={item} onClick={()=>setFilter(item)} aria-pressed={filter===item}>
     {item==="ALL"?"All":item==="UNREAD"?"Unread":item==="MENTIONS"?"Mentions":item==="TICKETS"?"Tickets":"Approvals"}
    </button>)}</div>
   {hasNotifications?<button type="button" disabled={loading||!!busy} onClick={()=>void mutation("/api/office-notifications",{action:"READ_ALL"})}>
    <CheckCheck size={16}/>Mark notifications read</button>:null}
  </div>
  {error?<p className={styles.error} role="alert"><TriangleAlert size={16}/>{error}</p>:null}
  {notice?<p className={styles.notice} role="status">{notice}</p>:null}
  {loading?<p aria-busy="true" role="status">Checking current source subscriptions…</p>:null}
  {!loading&&!error&&!shown.length?<div className={styles.empty}>
   {sourceStatus.every(s=>s.state!=="ok")?"No activity sources are authorized or available.":"No matching activity in your available sources."}
  </div>:null}
  {!loading&&!error?<div className={styles.list}>
   {shown.map(item=><article key={item.source+":"+item.id} data-unread={item.status==="UNREAD"}>
    <div className={styles.symbol}>{item.source==="mention"?<MessageCircle size={20}/>:
     item.source==="escalation"?<Headphones size={20}/>:
     item.kind==="APPROVALS"?<ClipboardCheck size={20}/>:<BellRing size={20}/>}</div>
    <div className={styles.content}><div><strong>{item.title}</strong>
     <time dateTime={item.at}>{when(item.at)}</time></div>
     <p>{item.detail}</p><small>{item.source==="notification"?"Office workflow":item.source==="mention"?"Private Connect":"Assigned IT escalation"}
      {" · "}{item.status}</small>
     <nav><Link href={item.href}>Open authorized source <ArrowRight size={15}/></Link>
      {item.actionable?<button type="button" disabled={!!busy}
       onClick={()=>void mutation(item.source==="mention"?"/api/office-chat/mentions":"/api/office-notifications",
        item.source==="mention"?{message_id:item.id}:{action:"READ",notification_id:item.id})}>
       <CheckCheck size={15}/>Mark read</button>:null}
     </nav>
    </div>
   </article>)}
  </div>:null}
  <footer className={styles.disclaimer}><ShieldCheck size={17}/>
   This view never grants access to a source ticket, approval, document or conversation. Restricted sources and stale memberships do not contribute fabricated counts or private previews.
  </footer>
 </section>;
}
