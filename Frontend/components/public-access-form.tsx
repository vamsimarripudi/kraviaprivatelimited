"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "./public-access.module.css";

export function PublicAccessForm({returnPath}:{returnPath:string}){
  const [email,setEmail]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [marketing,setMarketing]=useState(false);
  const [code,setCode]=useState("");
  const [challengeId,setChallengeId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(request:Promise<Response>) {
    const response=await request;
    const body=await response.json().catch(()=>({})) as {error?:string;challengeId?:string;verified?:boolean;returnPath?:string};
    if(!response.ok)throw new Error(body.error||"The request could not be completed.");
    return body;
  }
  async function start(event:FormEvent){
    event.preventDefault();setBusy(true);setError("");
    try{
      const result=await submit(fetch("/api/public-access/start",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({email,displayName:displayName||undefined,marketing,returnPath}),
      }));
      if(!result.challengeId)throw new Error("No verification challenge was returned.");
      setChallengeId(result.challengeId);
    }catch(err){setError(err instanceof Error?err.message:"Could not send a code.");}
    finally{setBusy(false);}
  }
  async function verify(event:FormEvent){
    event.preventDefault();setBusy(true);setError("");
    try{
      const result=await submit(fetch("/api/public-access/verify",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({challengeId,code,returnPath}),
      }));
      window.location.assign(result.returnPath||"/resources");
    }catch(err){setError(err instanceof Error?err.message:"Verification failed.");setBusy(false);}
  }
  return <div className={styles.panel}>
    {!challengeId?<form onSubmit={start}>
      <label className={styles.field}>Email address
        <input type="email" name="email" autoComplete="email" required maxLength={254}
          value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
      </label>
      <label className={styles.field}>Your name
        <input type="text" name="name" autoComplete="name" maxLength={120}
          value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="How should we address you?"/>
      </label>
      <label className={styles.check}>
        <input type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)}/>
        <span>I'd like to receive KRAVIA company and product updates by email. Optional — I can unsubscribe at any time. A separate confirmation email will follow.</span>
      </label>
      <button className={styles.button} type="submit" disabled={busy}>{busy?"Sending secure code…":"Continue with email"}</button>
      <p className={styles.notice}>Signing in and downloading resources do not subscribe you automatically. We'll email a one-time code to verify this address. See our <Link href="/legal/privacy" className={styles.link}>Privacy Policy</Link>.</p>
    </form>:<form onSubmit={verify}>
      <p className={styles.intro}>Enter the six-digit code sent to <strong>{email}</strong>. It expires after 10 minutes and can be used only once.</p>
      <label className={styles.field}>Email verification code
        <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
          value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} required placeholder="000000"/>
      </label>
      <div className={styles.actions}>
        <button className={styles.button} type="submit" disabled={busy||code.length!==6}>{busy?"Verifying…":"Verify and continue"}</button>
        <button className={styles.button+" "+styles.ghost} type="button" disabled={busy} onClick={()=>{setChallengeId(null);setCode("");setError("");}}>Use another address</button>
      </div>
      <p className={styles.notice}>For account safety, do not share your verification code with anyone, including KRAVIA staff.</p>
    </form>}
    {error?<p className={styles.message+" "+styles.error} role="alert">{error}</p>:null}
  </div>;
}
