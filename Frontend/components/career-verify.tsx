"use client";
import { useSearchParams,useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import styles from "./careers-public.module.css";
export function CareerVerify() {
  const search=useSearchParams(),router=useRouter();
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const token=search.get("token")||"";
  async function verify(){
    if(busy)return;setBusy(true);setError("");
    try{
      const res=await fetch("/api/careers/verify",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({token}),cache:"no-store",
      });
      const data=await res.json().catch(()=>null);
      if(!res.ok)throw new Error(data?.detail||"Verification is unavailable");
      router.replace("/careers/application");router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"Verification failed");}
    finally{setBusy(false);}
  }
  return <section className={styles.shell+" shell"} style={{minHeight:"55vh",maxWidth:850,margin:"auto"}}>
    <div className={styles.state}>
      <ShieldCheck size={30} color="#5f6aaf"/>
      <h1 className={styles.heading}>Confirm your private application</h1>
      <p>Use the confirmation button to verify that you requested access. Links are single use and expire after 30 minutes.</p>
      {!token||!(/^[A-Za-z0-9_-]{42,50}$/.test(token))?
        <div className={styles.error}>This link is incomplete or invalid. Request a new one from your application access page.</div>
        :<button type="button" className={styles.button} disabled={busy} onClick={()=>void verify()}>
          <ShieldCheck size={16}/>{busy?"Verifying…":"Verify and continue"}
        </button>}
      {error?<p className={styles.error} role="alert">{error}</p>:null}
      <Link className={styles.back} href="/careers/application">Request application access</Link>
    </div>
  </section>;
}
