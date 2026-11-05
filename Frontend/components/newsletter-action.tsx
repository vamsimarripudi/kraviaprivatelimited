"use client";
import {useState} from "react";
import styles from "./public-access.module.css";
export function NewsletterAction({action,token}:{action:"confirm"|"unsubscribe";token:string}){
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function submit(){
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/newsletter/action",{method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({action,token})});
   const payload=await response.json() as {status?:string;error?:string};
   if(!response.ok)throw new Error(payload.error||"Could not update your subscription.");
   setMessage(action==="confirm"?"Your KRAVIA newsletter subscription is confirmed.":"You have been unsubscribed. You can still use KRAVIA resources.");
  }catch(error){setMessage(error instanceof Error?error.message:"The request could not be completed.");}
  finally{setBusy(false);}
 }
 return <div className={styles.panel}>
  <p className={styles.intro}>{action==="confirm"?"Confirm that you want to receive optional KRAVIA email newsletters.":"Confirm that you want to stop optional KRAVIA newsletter emails. Account and security messages are unaffected."}</p>
  <button disabled={busy||!!message} type="button" className={styles.button} onClick={()=>void submit()}>{busy?"Processing…":action==="confirm"?"Confirm newsletter":"Unsubscribe now"}</button>
  {message?<p role="status" className={styles.message}>{message}</p>:null}
 </div>;
}
