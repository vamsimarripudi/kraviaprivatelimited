"use client";
import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,Bookmark,CheckCircle2,RefreshCw,Search} from "lucide-react";
import styles from "./office-connect-index.module.css";
type Item={id:string;conversation_id:string;sender_user_id:string;sender_name:string;body:string;created_at:string;read_at?:string|null};
type Kind="search"|"saved"|"mentions";
const routes:Record<Kind,string>={search:"/api/office-chat/search",saved:"/api/office-chat/saved",mentions:"/api/office-chat/mentions"};
export function OfficeConnectMessageIndex({kind}:{kind:Kind}){
 const [items,setItems]=useState<Item[]>([]);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [notice,setNotice]=useState("");
 const [query,setQuery]=useState("");
 const [submitted,setSubmitted]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [pending,setPending]=useState("");
 useEffect(()=>{
  let live=true;
  void (async()=>{try{
    const url=routes[kind]+(kind==="search"?"?q="+encodeURIComponent(submitted):"");
    const response=await fetch(url,{cache:"no-store",credentials:"same-origin"});
    const result=await response.json().catch(()=>({})) as {messages?:Item[];detail?:string};
    if(!response.ok)throw new Error(result.detail||"Private index unavailable");
    if(live){setItems(result.messages??[]);setError("");}
   }catch(e){if(live)setError(e instanceof Error?e.message:"Index unavailable");}
   finally{if(live)setLoading(false);}
  })();
  return()=>{live=false;};
 },[kind,refresh,submitted]);
 async function action(item:Item){
  setPending(item.id);setError("");setNotice("");
  try{
   const request=kind==="mentions"?{url:routes.mentions,method:"PATCH",body:{message_id:item.id}}:
    {url:routes.saved,method:"POST",body:{message_id:item.id,save:false}};
   const response=await fetch(request.url,{method:request.method,headers:{"Content-Type":"application/json"},
    credentials:"same-origin",body:JSON.stringify(request.body)});
   const result=await response.json().catch(()=>({})) as {detail?:string};
   if(!response.ok)throw new Error(result.detail||"Action not confirmed");
   setNotice(kind==="mentions"?"Mention marked read":"Saved reference removed");setLoading(true);setRefresh(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:"Action failed");}
  finally{setPending("");}
 }
 const headings:{[K in Kind]:string}={search:"Search private conversations",saved:"Saved messages",mentions:"My mentions"};
 return <section className={styles.shell}>
  <Link href="/office/chat" className={styles.back}><ArrowLeft size={16}/>Connect</Link>
  <header><div><p>KRAVIA CONNECT · PERMISSION SCOPED</p><h1>{headings[kind]}</h1>
   <span>Results only include your current authorized conversations. Revoked access immediately removes visibility.</span>
  </div><button type="button" onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}><RefreshCw size={15}/>Refresh</button></header>
  {kind==="search"?<form className={styles.search} onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setLoading(true);setSubmitted(query);setRefresh(v=>v+1);}}>
    <label htmlFor="office-chat-query">Search messages</label>
    <div><input id="office-chat-query" value={query} onChange={e=>setQuery(e.target.value)} maxLength={100}
       placeholder="Search permitted message text"/><button type="submit"><Search size={17}/>Search</button></div>
    </form>:null}
  {notice?<p className={styles.notice} role="status"><CheckCircle2 size={16}/>{notice}</p>:null}
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  {loading?<p aria-busy="true" role="status">Loading your messages…</p>:null}
  {!loading&&!error&&items.length===0?<div className={styles.empty}>
    {kind==="search"&&!submitted?"Enter a query to search your authorized message history.":"No accessible messages match this view."}</div>:null}
  {!loading&&!error?<div className={styles.list}>{items.map(item=><article key={item.id}>
    <div><strong>{item.sender_name}</strong>
     <span>{new Date(item.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}
     {kind==="mentions"?(item.read_at?" · Read":" · Unread"):""}</span></div>
    <p>{item.body}</p>
    <footer><Link href={"/office/chat/threads/"+item.id}><ArrowRight size={16}/>Open source thread</Link>
     {kind==="saved"?<button type="button" disabled={!!pending} onClick={()=>void action(item)}>
       <Bookmark size={14}/>{pending===item.id?"Updating…":"Unsave"}</button>:null}
     {kind==="mentions"&&!item.read_at?<button type="button" disabled={!!pending} onClick={()=>void action(item)}>
       <CheckCircle2 size={14}/>{pending===item.id?"Updating…":"Mark read"}</button>:null}
    </footer>
  </article>)}</div>:null}
 </section>;
}
