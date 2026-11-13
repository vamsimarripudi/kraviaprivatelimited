"use client";
import {useEffect,useState} from "react";
import {OfficeConnect} from "@/components/office-connect";
import Link from "next/link";
import {ArrowLeft,Building2,ShieldCheck} from "lucide-react";
import styles from "./office-connect-channel.module.css";
type Info={department:string;conversation_id:string|null;joined:boolean;detail?:string};
export function OfficeConnectChannel({code}:{code:string}){
 const [data,setData]=useState<Info>();
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;
  void (async()=>{try{
   const response=await fetch("/api/office-chat/channels?code="+encodeURIComponent(code),{
    credentials:"same-origin",cache:"no-store"});
   const body=await response.json().catch(()=>({})) as Info;
   if(!response.ok)throw new Error(body.detail||"Channel unavailable");
   if(active){setData(body);setError("");}
  }catch(e){if(active){setData(undefined);setError(e instanceof Error?e.message:"Channel unavailable");}}
  finally{if(active)setLoading(false);}
  })();return()=>{active=false;};
 },[code,retry]);
 async function join(){
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/office-chat/channels",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});
   const body=await response.json().catch(()=>({})) as {conversation_id?:string;detail?:string};
   if(!response.ok||!body.conversation_id)throw new Error(body.detail||"Channel membership not verified");
   setData({department:code,conversation_id:body.conversation_id,joined:true});
  }catch(e){setError(e instanceof Error?e.message:"Join not confirmed");}
  finally{setBusy(false);}
 }
 if(data?.conversation_id&&data.joined)return <OfficeConnect initialConversationId={data.conversation_id}/>;
 return <section className={styles.shell}>
  <Link href="/office/chat"><ArrowLeft size={17}/>Connect</Link>
  <Building2 size={26} aria-hidden="true"/><h1>Department channel</h1>
  <p>A verified, active canonical job assignment is required. A historical chat membership does not permit access after a department transfer.</p>
  {loading?<p role="status" aria-busy="true">Checking your current department assignment…</p>:null}
  {error?<p role="alert" className={styles.error}>{error}
    <button type="button" onClick={()=>{setLoading(true);setRetry(v=>v+1);}}>Retry</button></p>:null}
  {data&&!data.joined?<div className={styles.card}><ShieldCheck size={25}/>
    <h2>{data.department} · controlled employee channel</h2>
    <p>Opening the channel registers your membership. This action does not affect your department assignment, Office permissions or any formal approval.</p>
    <button type="button" disabled={busy} onClick={()=>void join()}>{busy?"Verifying…":"Open authorized channel"}</button>
   </div>:null}
 </section>;
}
