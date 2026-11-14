"use client";
import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowRight,CheckCircle2,FileCheck2,LockKeyhole,RefreshCw,ShieldCheck} from "lucide-react";
import styles from "./office-vault-verification-queue.module.css";
type RecordRow={id:string;registration_code:string;title:string;registration_type:string;
 authority:string;identifier_masked:string;source_reference:string;
 evidence_reference:string|null;created_at:string;grant_category:"identity"|"registrations"};
type Queue={scope:"VAULT_GRANTED_SOURCE_REVIEWS";generated_at:string;
 actor_user_id:string;items:RecordRow[];disclaimer:string;detail?:string};
export function OfficeVaultVerificationQueue(){
 const [queue,setQueue]=useState<Queue|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [record,setRecord]=useState<RecordRow|null>(null);
 const [decision,setDecision]=useState<"ACTIVE"|"REJECTED">("ACTIVE");
 const [note,setNote]=useState("");
 const [evidence,setEvidence]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  let live=true;
  void fetch("/api/office-vault/verification",{credentials:"same-origin",cache:"no-store"})
   .then(async response=>{
    const data=await response.json().catch(()=>({})) as Queue;
    if(!response.ok||data.scope!=="VAULT_GRANTED_SOURCE_REVIEWS")throw Error(data.detail||"Review queue unavailable");
    return data;
   }).then(data=>{if(live){setQueue(data);setError("");}})
   .catch(e=>{if(live){setQueue(null);setError(e instanceof Error?e.message:"Review queue unavailable");}})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[refresh]);
 function open(item:RecordRow){
  setRecord(item);setDecision("ACTIVE");setNote("");setEvidence(item.evidence_reference??"");setNotice("");
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!record||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/office-vault/verification",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({record_id:record.id,decision,note:note.trim(),
     evidence_reference:evidence.trim()||undefined}),
   });
   const value=await response.json().catch(()=>({})) as {status?:string;detail?:string};
   if(!response.ok)throw Error(value.detail||"Review not confirmed");
   setNotice("Canonical independent review recorded: "+(value.status??decision));
   setRecord(null);setLoading(true);setRefresh(x=>x+1);
  }catch(e){setError(e instanceof Error?e.message:"Review was not confirmed");}
  finally{setBusy(false);}
 }
 return <section className={styles.shell} aria-label="K-Vault independent evidence review">
  <header><div><p>INDEPENDENT EVIDENCE VERIFICATION</p>
   <h2>Authorized registration reviews</h2>
   <span>Only source records with a current explicit Vault grant and separate review permission appear.</span></div>
   <button type="button" disabled={loading||busy} onClick={()=>{setLoading(true);setRefresh(x=>x+1);}}>
    <RefreshCw size={16}/>{loading?"Verifying…":"Refresh"}</button></header>
  {notice?<p role="status" className={styles.notice}><CheckCircle2 size={17}/>{notice}</p>:null}
  {error?<div className={styles.error} role="alert"><LockKeyhole size={18}/>{error}</div>:null}
  {loading?<p role="status" aria-busy="true">Reading the current independent review queue…</p>:null}
  {!loading&&!error&&queue?<><div className={styles.intro}><FileCheck2 size={19}/>
    <span>{queue.items.length} pending, independently reviewable registration(s) in your authorized Vault scope.</span></div>
   {queue.items.length?<div className={styles.list}>{queue.items.map(item=><article key={item.id}>
    <div><strong>{item.title}</strong><small>{item.registration_code} · {item.registration_type} · {item.authority}</small>
     <small>Masked reference: {item.identifier_masked} · Vault grant: {item.grant_category}</small>
     <small>Authoritative source: {item.source_reference}</small>
    </div><button type="button" disabled={busy} onClick={()=>open(item)}>Review evidence <ArrowRight size={15}/></button>
   </article>)}</div>:<p className={styles.empty}>No current authorized registration evidence awaits independent review.</p>}
   <p className={styles.policy}><ShieldCheck size={16}/>{queue.disclaimer}</p>
  </>:null}
  {record?<form className={styles.review} onSubmit={submit}>
   <h3>Review registration: {record.title}</h3>
   <p>Confirm the evidence independently. A successful decision updates only the canonical Registration Registry.</p>
   <label>Independent decision<select value={decision} onChange={e=>setDecision(e.target.value as "ACTIVE"|"REJECTED")}>
    <option value="ACTIVE">Verify as active</option><option value="REJECTED">Reject evidence</option>
   </select></label>
   <label>Authoritative evidence reference<input value={evidence} maxLength={1200}
    required={decision==="ACTIVE"} onChange={e=>setEvidence(e.target.value)}
    placeholder="Verified evidence reference or traceable source"/></label>
   <label>Reviewer rationale<textarea required minLength={10} maxLength={2000} rows={4}
    value={note} onChange={e=>setNote(e.target.value)}/></label>
   <div className={styles.actions}><button type="button" onClick={()=>setRecord(null)} disabled={busy}>Cancel</button>
    <button type="submit" disabled={busy||note.trim().length<10||decision==="ACTIVE"&&!evidence.trim()}>
     {busy?"Recording…":"Submit independent review"}</button></div>
   <p>Source authority rechecks creator separation, registration state, current Vault grant, and record access before committing.</p>
  </form>:null}
  <div className={styles.links}><Link href="/office/registrations">Canonical Registration Registry <ArrowRight size={16}/></Link>
   <Link href="/office/documents">Document Studio reviews <ArrowRight size={16}/></Link>
   <Link href="/office/k-vault/access">Vault access requests and grant review <ArrowRight size={16}/></Link></div>
 </section>;
}
