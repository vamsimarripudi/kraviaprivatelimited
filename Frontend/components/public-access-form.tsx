"use client";
import {useState,type FormEvent} from "react";
import Link from "next/link";
import styles from "./public-access.module.css";
type Reply={challengeId?:string;returnPath?:string;error?:string};
export function PublicAccessForm({returnPath}:{returnPath:string}){
 const [email,setEmail]=useState(""),[displayName,setName]=useState(""),[marketing,setMarketing]=useState(false);
 const [challenge,setChallenge]=useState<string|null>(null),[code,setCode]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function post(path:string,payload:object){
  const r=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const data=await r.json().catch(()=>({})) as Reply;
  if(!r.ok)throw Error(data.error||"The request could not be completed.");return data;
 }
 async function start(e:FormEvent){
  e.preventDefault();setBusy(true);setError("");
  try{const d=await post("/api/public-access/start",{email,displayName:displayName||undefined,marketing,returnPath});
   if(!d.challengeId)throw Error("Verification could not be started.");setChallenge(d.challengeId);}
  catch(e){setError(e instanceof Error?e.message:"Verification unavailable.");}
  finally{setBusy(false);}
 }
 async function verify(e:FormEvent){
  e.preventDefault();setBusy(true);setError("");
  try{const d=await post("/api/public-access/verify",{challengeId:challenge,code,returnPath});
   window.location.assign(d.returnPath||"/resources");}
  catch(e){setError(e instanceof Error?e.message:"Incorrect code.");setBusy(false);}
 }
 return <section className={styles.card}>{challenge?
  <form onSubmit={e=>void verify(e)}><p className={styles.intro}>Enter the six-digit code sent to <strong>{email}</strong>. It expires in 10 minutes.</p>
   <label className={styles.field}>Verification code<input autoComplete="one-time-code" inputMode="numeric" required pattern="[0-9]{6}" maxLength={6}
     value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/></label>
   <div className={styles.actions}><button className={styles.button} disabled={busy||code.length!==6}>{busy?"Verifying…":"Verify and continue"}</button>
   <button type="button" disabled={busy} className={styles.button+" "+styles.secondary} onClick={()=>{setChallenge(null);setCode("");setError("");}}>Use another address</button></div></form>:
  <form onSubmit={e=>void start(e)}>
   <label className={styles.field}>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label className={styles.field}>Your name<input type="text" autoComplete="name" maxLength={120} value={displayName} onChange={e=>setName(e.target.value)}/></label>
   <label className={styles.check}><input type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)}/>
    <span>I would like optional KRAVIA company and product newsletters. I can unsubscribe at any time, and will confirm separately by email.</span></label>
   <button className={styles.button} disabled={busy}>{busy?"Sending…":"Send verification code"}</button>
   <p className={styles.notice}>No password required. Registration or downloading never subscribes you automatically. See our <Link className={styles.link} href="/legal/privacy">Privacy Policy</Link>.</p>
  </form>}
  {error?<p className={styles.message+" "+styles.error} role="alert">{error}</p>:null}
 </section>;
}
