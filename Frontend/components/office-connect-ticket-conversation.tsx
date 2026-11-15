"use client";

import {useEffect,useMemo,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowUpRight,CheckCheck,LifeBuoy,RefreshCw,Send,ShieldCheck} from "lucide-react";
import styles from "./office-connect-ticket-conversation.module.css";

type EventItem={id:string|number;actor_user_id:string;event_type:string;note?:string|null;created_at:string;previous_status?:string|null;new_status?:string|null};
type Ticket={id:string;title?:string;subject?:string;status:string;requester_user_id?:string;owner_user_id?:string;ticket_code?:string;case_code?:string;events?:EventItem[]};
type Response={actor:{user_id:string};capabilities?:{manage:boolean};can_manage?:boolean;tickets?:Ticket[];cases?:Ticket[];events?:EventItem[];detail?:string};
export type ConversationKind="it"|"support";
function day(value:string){return new Intl.DateTimeFormat("en-IN",
  {timeZone:"Asia/Kolkata",day:"numeric",month:"short",year:"numeric"}).format(new Date(value));}
function when(value:string){return new Intl.DateTimeFormat("en-IN",
  {timeZone:"Asia/Kolkata",hour:"numeric",minute:"2-digit",hour12:true}).format(new Date(value));}

export function OfficeConnectTicketConversation({kind,id}:{kind:ConversationKind;id:string}){
 const [record,setRecord]=useState<Ticket|null>(null);
 const [events,setEvents]=useState<EventItem[]>([]);
 const [actor,setActor]=useState("");
 const [allowedToReply,setAllowedToReply]=useState(false);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [reply,setReply]=useState("");
 const [revision,setRevision]=useState(0);
 const api=kind==="it"?"/api/office-it":"/api/office-support";
 useEffect(()=>{
  let live=true;const controller=new AbortController();
  void fetch(api,{credentials:"same-origin",cache:"no-store",signal:controller.signal})
   .then(async result=>{
    const body=await result.json().catch(()=>({})) as Response;
    if(!result.ok)throw new Error(body.detail??"Ticket source unavailable");
    const row=(kind==="it"?body.tickets:body.cases)?.find(item=>item.id===id);
    if(!row)throw new Error("The ticket is not available under your current permissions.");
    if(!live)return;
    setRecord(row);
    setEvents((kind==="it"?(body.events??[]).filter(event=>String((event as EventItem&{ticket_id?:string}).ticket_id)===id):row.events??[]).slice().reverse());
    setActor(body.actor?.user_id??"");
    setAllowedToReply(kind==="it"?Boolean(
      body.actor?.user_id&&(body.actor.user_id===row.requester_user_id
      ||body.actor.user_id===row.owner_user_id||body.capabilities?.manage))
      :body.can_manage===true);
    setError("");setLoading(false);
   }).catch(e=>{if(live){setError(e instanceof Error?e.message:"Ticket unavailable");setLoading(false);setRecord(null);}});
  return()=>{live=false;controller.abort();};
 },[api,id,kind,revision]);

 const sorted=useMemo(()=>[...events].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)),[events]);
 async function send(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const body=reply.trim();
  if(!record||!allowedToReply||!body||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
    const response=await fetch(api,{method:"POST",credentials:"same-origin",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(kind==="it"?{action:"REPLY_TICKET",ticket_id:id,body}
        :{action:"REPLY_CASE",case_id:id,body})});
    const result=await response.json().catch(()=>({})) as {reply_id?:string;detail?:string};
    if(!response.ok||!result.reply_id)throw Error(result.detail??"The ticket reply was not confirmed");
    setReply("");setNotice("Reply recorded in the governed ticket timeline");
    setRevision(x=>x+1);
  }catch(e){setError(e instanceof Error?e.message:"Reply was not recorded. Your draft is preserved.");}
  finally{setBusy(false);}
 }
 const closed=record?["CLOSED","CANCELLED"].includes(record.status):true;
 return <section className={styles.shell} aria-label={kind==="it"?"IT ticket conversation":"Support case conversation"}>
  <header className={styles.header}>
   <Link href="/office/chat" aria-label="Return to My Chats" title="My Chats"><ArrowLeft size={20}/></Link>
   <div><small>{kind==="it"?"IT SERVICE · GOVERNED RECORD":"CUSTOMER SUPPORT · GOVERNED RECORD"}</small>
    <h1>{record?.title??record?.subject??(kind==="it"?"IT ticket":"Support case")}</h1>
    <span>{record?(record.ticket_code??record.case_code??"Ticket")+" · "+record.status:"Verifying ticket access…"}</span></div>
   <button type="button" title="Refresh ticket conversation" aria-label="Refresh ticket conversation"
     onClick={()=>{setLoading(true);setRevision(x=>x+1);}}><RefreshCw size={18}/></button>
  </header>
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  {notice?<p className={styles.notice} role="status"><CheckCheck size={16}/>{notice}</p>:null}
  <div className={styles.timeline} role="log" aria-label="Authorized ticket conversation timeline" aria-live="polite">
   {loading?<p className={styles.state} role="status">Loading assigned ticket messages…</p>:null}
   {!loading&&record&&sorted.length===0?<div className={styles.empty}>
    <LifeBuoy size={27}/><strong>No replies on this ticket yet</strong>
    <p>Replies remain with the original assigned ticket and its audit history.</p></div>:null}
   {!loading&&record?sorted.map((item,i)=><div key={String(item.id)} className={styles.entryWrap}>
    {i===0||day(sorted[i-1].created_at)!==day(item.created_at)?
      <div className={styles.date}><span>{day(item.created_at)}</span></div>:null}
    <article className={styles.entry} data-own={item.actor_user_id===actor}>
     <small>{item.actor_user_id===actor?"You":kind==="it"?"IT participant":"Support participant"}</small>
     <p>{item.note||item.event_type.replaceAll("_"," ").toLowerCase()}</p>
     <time dateTime={item.created_at}>{when(item.created_at)}</time>
    </article>
   </div>):null}
  </div>
  {record&&allowedToReply&&!closed?<form className={styles.composer} onSubmit={send}>
   <label className={styles.srOnly} htmlFor="kravia-ticket-reply">Reply to the authorized ticket</label>
   <textarea id="kravia-ticket-reply" value={reply} onChange={e=>setReply(e.target.value)}
     minLength={1} maxLength={kind==="it"?1000:4000} rows={2}
     placeholder="Reply in this ticket…"
     required disabled={busy}/>
   <button type="submit" disabled={busy||!reply.trim()} aria-label="Send ticket reply">
    <Send size={19}/><span>{busy?"Sending":"Send"}</span></button>
  </form>:null}
  {record&&!allowedToReply?<div className={styles.restriction} role="status">
    <ShieldCheck size={17}/>Replies require your current assigned ticket authority. History is read-only.</div>:null}
  {record&&closed?<div className={styles.restriction} role="status">
    <ShieldCheck size={17}/>This ticket is closed. Its conversation is preserved as an audit record.</div>:null}
  <footer><ShieldCheck size={15}/>Only source-confirmed ticket messages are shown. This conversation cannot authorize refunds, system access or ticket approvals.
   <Link href={kind==="it"?"/office/it":"/office/support"}>Open source <ArrowUpRight size={14}/></Link></footer>
 </section>;
}
