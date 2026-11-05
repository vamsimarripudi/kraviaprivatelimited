"use client";
import {useState} from "react";
import styles from "./public-access.module.css";
export function PublicAccountControls({status}:{status:string}){
 const [current,setCurrent]=useState(status),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function save(subscribe:boolean){
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/public-access/preferences",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({subscribe})});
   const data=await r.json().catch(()=>({})) as {status?:string;error?:string};
   if(!r.ok)throw Error(data.error||"Unable to update preferences.");
   setCurrent(data.status||current);setMessage(subscribe?"Check your email to confirm the subscription.":"You have unsubscribed.");
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to update.");}finally{setBusy(false);}
 }
 async function logout(){
  setBusy(true);
  try{const r=await fetch("/api/public-access/logout",{method:"POST"});if(!r.ok)throw Error("Unable to sign out.");
   window.location.assign("/resources");}
  catch{setMessage("Sign out failed. Please retry.");setBusy(false);}
 }
 return <div className={styles.card}><h2>Email preferences</h2>
  <p>Newsletter: <strong>{current==="ACTIVE"?"Subscribed":current==="PENDING"?"Awaiting confirmation":current==="UNSUBSCRIBED"?"Unsubscribed":"Not subscribed"}</strong></p>
  <p>Optional newsletters are separate from account security emails.</p>
  <div className={styles.actions}>
   {current==="ACTIVE"||current==="PENDING"?
    <button type="button" disabled={busy} className={styles.button+" "+styles.secondary} onClick={()=>void save(false)}>Unsubscribe</button>:
    <button type="button" disabled={busy} className={styles.button} onClick={()=>void save(true)}>Subscribe to updates</button>}
   <button type="button" disabled={busy} className={styles.button+" "+styles.secondary} onClick={()=>void logout()}>Sign out</button>
  </div>{message?<p role="status" className={styles.message}>{message}</p>:null}
 </div>;
}
