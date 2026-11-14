"use client";
import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,CheckCircle2,LockKeyhole,RefreshCw,ShieldCheck} from "lucide-react";
import type {ConnectPrefs} from "@/lib/office/chat-preferences-server";
import styles from "./office-connect-governance.module.css";
type Answer={scope:"OWN";preferences:ConnectPrefs;updated_at:string|null;detail?:string};
const fields:{key:keyof ConnectPrefs;label:string;help:string}[]=[
 {key:"notify_direct",label:"Direct messages",help:"Save your preferred direct-message alert setting"},
 {key:"notify_mentions",label:"Mentions",help:"Save your preferred mention-alert setting"},
 {key:"notify_ticket_updates",label:"Assigned IT ticket events",help:"Save your preferred source-ticket alert setting"},
 {key:"email_digest_opt_in",label:"Email digest opt-in",help:"Consent is saved; no digest is sent without separately approved delivery"},
 {key:"share_read_receipts",label:"Share read receipts",help:"No colleague receipt information is exposed by this settings screen"},
 {key:"reduce_motion",label:"Reduce Connect animations",help:"Applies to Connect screens for your signed-in session"},
];
export function OfficeConnectSettings(){
 const [value,setValue]=useState<ConnectPrefs|null>(null);
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;
  void fetch("/api/office-chat/preferences",{cache:"no-store",credentials:"same-origin"})
   .then(async res=>{const body=await res.json().catch(()=>({})) as Answer;
    if(!res.ok||body.scope!=="OWN"||!body.preferences)throw Error(body.detail||"Settings unavailable");
    return body;
   }).then(body=>{if(active){setValue(body.preferences);setError("");}})
   .catch(e=>{if(active){setValue(null);setError(e instanceof Error?e.message:"Settings unavailable");}})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;};
 },[refresh]);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!value||saving)return;setSaving(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/office-chat/preferences",{method:"PUT",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(value)});
   const body=await response.json().catch(()=>({})) as Answer;
   if(!response.ok||body.scope!=="OWN"||!body.preferences)throw Error(body.detail||"Save not confirmed");
   setValue(body.preferences);setNotice("Settings saved to your verified Office identity.");
   window.dispatchEvent(new CustomEvent("kravia-connect-preferences-change",
    {detail:{reduce_motion:body.preferences.reduce_motion}}));
  }catch(e){setError(e instanceof Error?e.message:"Save unavailable")}finally{setSaving(false)}
 }
 return <section className={styles.shell} aria-label="Connect personal settings">
  <Link className={styles.back} href="/office/chat"><ArrowLeft size={16}/>Connect</Link>
  <header><div><p>CURRENT VERIFIED OFFICE IDENTITY</p><h1>Personal settings</h1>
   <span>Notification preferences and accessibility, independent of organization policy.</span>
  </div><button type="button" disabled={loading||saving} onClick={()=>{setLoading(true);setRefresh(x=>x+1)}}>
   <RefreshCw size={16}/>Reload</button></header>
  {loading?<p role="status" aria-busy="true">Checking your personal settings…</p>:null}
  {error?<p className={styles.error} role="alert"><LockKeyhole size={17}/>{error}</p>:null}
  {notice?<p role="status" className={styles.status}><CheckCircle2 size={17}/>{notice}</p>:null}
  {!loading&&value?<form onSubmit={save} className={styles.mappings}>
    <h2>Message and notification choices</h2>
    {fields.map(row=><label key={row.key} style={{display:"flex",alignItems:"center",gap:16,
      justifyContent:"space-between",padding:14,border:"1px solid var(--office-ui-line)",borderRadius:12}}>
     <span style={{display:"grid",gap:5}}><strong style={{fontSize:13}}>{row.label}</strong>
      <small>{row.help}</small></span>
     <input type="checkbox" style={{width:24,height:24,flexShrink:0}}
      checked={value[row.key]}
      onChange={e=>setValue(old=>old?{...old,[row.key]:e.target.checked}:old)}/>
    </label>)}
    <p>These entries record personal choices. Only the separately governed notification service may send email or publish peer receipts. This form makes no deliveries or IAM changes.</p>
    <div className={styles.links}>
     <button type="submit" disabled={saving}>{saving?"Saving…":"Save personal settings"}</button>
     <Link href="/office/settings">Office theme and account security <ArrowRight size={15}/></Link>
    </div>
  </form>:null}
  <div className={styles.notice}><ShieldCheck size={16}/>
   No confidential messages, passwords, OTPs, staff roles or legal hold controls are stored as personal preferences.
  </div>
 </section>;
}
