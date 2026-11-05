"use client";
import {useState} from "react";
import styles from "./public-access.module.css";
export function NewsletterAction({action,token}:{action:"confirm"|"unsubscribe";token:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function submit(){
  setBusy(true);setMessage("");
  try{const r=await fetch("/api/newsletter/action",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,token})});
   const d=await r.json().catch(()=>({})) as {error?:string};
   if(!r.ok)throw Error(d.error||"This link may have expired.");
   setMessage(action==="confirm"?"Your subscription is confirmed.":"You have unsubscribed from optional KRAVIA newsletters.");
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to process request.");}
  finally{setBusy(false);}
 }
 return <section className={styles.card}><p>{action==="confirm"?"Confirm your request to receive KRAVIA email updates.":"Stop optional KRAVIA newsletters. Necessary account and security messages are unaffected."}</p>
  <button type="button" className={styles.button} disabled={busy||!!message} onClick={()=>void submit()}>{busy?"Processing…":action==="confirm"?"Confirm subscription":"Unsubscribe now"}</button>
  {message?<p role="status" className={styles.message}>{message}</p>:null}
 </section>;
}
