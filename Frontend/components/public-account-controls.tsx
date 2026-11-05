"use client";
import {useState} from "react";
import styles from "./public-access.module.css";
export function PublicAccountControls({status}:{status:string}){
 const [current,setCurrent]=useState(status);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function update(subscribe:boolean){
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/public-access/preferences",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({subscribe})});
   const body=await response.json() as {status?:string;error?:string};
   if(!response.ok)throw new Error(body.error||"Could not update preference.");
   setCurrent(body.status||current);setMessage(subscribe?"Check your inbox to confirm your subscription.":"You have been unsubscribed.");
  }catch(error){setMessage(error instanceof Error?error.message:"Unable to update.");}
  finally{setBusy(false);}
 }
 async function logout(){
  setBusy(true);
  const response=await fetch("/api/public-access/logout",{method:"POST"});
  if(response.ok)window.location.assign("/resources");else{setMessage("Could not sign out. Please retry.");setBusy(false);}
 }
 return <div className={styles.card}>
  <h2>Email preferences</h2>
  <p>Newsletter: <strong>{current==="ACTIVE"?"Subscribed":current==="PENDING"?"Awaiting email confirmation":current==="UNSUBSCRIBED"?"Unsubscribed":"Not subscribed"}</strong></p>
  <p>Product updates and newsletters are optional and separate from essential account messages.</p>
  <div className={styles.actions}>
   {current==="ACTIVE"||current==="PENDING"?<button type="button" disabled={busy} className={styles.button+" "+styles.ghost} onClick={()=>void update(false)}>Unsubscribe</button>
    :<button type="button" disabled={busy} className={styles.button} onClick={()=>void update(true)}>Request newsletter subscription</button>}
   <button type="button" disabled={busy} className={styles.button+" "+styles.ghost} onClick={()=>void logout()}>Sign out</button>
  </div>
  {message?<p role="status" className={styles.message}>{message}</p>:null}
 </div>;
}
