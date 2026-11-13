"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowLeft,Send,ShieldCheck} from "lucide-react";
import {OfficeConnectMessageActions} from "@/components/office-connect-message-actions";
import styles from "./office-connect-thread.module.css";
type Message={id:string;sender_user_id:string;sender_name:string;body:string;created_at:string;parent_message_id?:string|null};
type Response={conversation_id:string;messages:Message[]};
export function OfficeConnectThread({id}:{id:string}){
 const [data,setData]=useState<Response>();
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true);
 const [retry,setRetry]=useState(0);
 const [draft,setDraft]=useState("");
 const [sending,setSending]=useState(false);
 const nonce=useRef<string|null>(null);
 useEffect(()=>{
  let live=true;
  void (async()=>{try{
    const result=await fetch("/api/office-chat/threads/"+id,{credentials:"same-origin",cache:"no-store"});
    const body=await result.json().catch(()=>({})) as Response&{detail?:string};
    if(!result.ok)throw new Error(body.detail||"Thread unavailable");
    if(live){setData(body);setError("");}
   }catch(e){if(live){setData(undefined);setError(e instanceof Error?e.message:"Thread unavailable");}}
   finally{if(live)setLoading(false);}
  })();return()=>{live=false;};
 },[id,retry]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!draft.trim()||sending)return;
  setSending(true);setNotice("");setError("");nonce.current??=window.crypto.randomUUID();
  try{
   const r=await fetch("/api/office-chat/threads/"+id,{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({body:draft.trim(),client_nonce:nonce.current})});
   const body=await r.json().catch(()=>({})) as {detail?:string};
   if(!r.ok)throw new Error(body.detail||"Reply not confirmed");
   nonce.current=null;setDraft("");setNotice("Thread reply recorded");
   setLoading(true);setRetry(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:"Reply not confirmed; the draft is preserved");}
  finally{setSending(false);}
 }
 return <section className={styles.thread} aria-label="Private conversation thread">
  <Link href="/office/chat" className={styles.back}><ArrowLeft size={16}/>Connect conversations</Link>
  <header><p>KRAVIA CONNECT · THREAD</p><h1>Replies and message context</h1>
   <span>Only current conversation members can open or reply. Chat is not an authoritative approval.</span></header>
  {loading?<div className={styles.state} role="status">Loading permitted thread…</div>:null}
  {error?<div className={styles.error} role="alert">{error}
   <button type="button" onClick={()=>{setLoading(true);setRetry(v=>v+1);}}>Retry</button></div>:null}
  {notice?<p className={styles.notice} role="status">{notice}</p>:null}
  {data?<div className={styles.messages}>
   {data.messages.map((message,i)=><article key={message.id} data-parent={i===0}>
    <div><strong>{message.sender_name}</strong><time dateTime={message.created_at}>
     {new Date(message.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}
    </time></div><p>{message.body}</p>
    <OfficeConnectMessageActions id={message.id} body={message.body} own={false} onDone={()=>setRetry(v=>v+1)}/>
   </article>)}
  </div>:null}
  {data?<form className={styles.composer} onSubmit={submit}>
   <label htmlFor="office-thread-reply">Reply in thread</label>
   <div><textarea id="office-thread-reply" required rows={3} minLength={1} maxLength={4000}
    value={draft} disabled={sending} onChange={e=>{nonce.current=null;setDraft(e.target.value);}}
    onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")e.currentTarget.form?.requestSubmit();}}/>
    <button type="submit" disabled={sending||!draft.trim()}><Send size={16}/>{sending?"Sending…":"Reply"}</button></div>
  </form>:null}
  <p className={styles.footer}><ShieldCheck size={16}/>Conversation membership is rechecked for every request and write.</p>
 </section>;
}
