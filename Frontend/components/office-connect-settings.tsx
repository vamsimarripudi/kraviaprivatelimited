"use client";
import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,Bell,Eye,EyeOff,Mail,Monitor,Moon,ShieldCheck,Sun} from "lucide-react";
import type {ConnectPrefs} from "@/lib/office/chat-preferences-server";
import {readConnectPreferences,saveConnectPreferences,saveMotionMode,
 type ConnectPreferences} from "@/lib/office/connect-preferences";
import styles from "./office-connect-settings.module.css";
const themeKey="kravia.office.appearance";
type Theme="light"|"dark";
type ServerAnswer={scope:"OWN";preferences:ConnectPrefs;updated_at:string|null;detail?:string};
const fields:{key:keyof ConnectPrefs;title:string;help:string}[]=[
 {key:"notify_direct",title:"Direct messages",help:"Your preferred direct-message notification setting; delivery requires the approved notifier."},
 {key:"notify_mentions",title:"Mentions",help:"Your preferred mention notification setting; delivery requires the approved notifier."},
 {key:"notify_ticket_updates",title:"Assigned IT tickets",help:"Your preferred ticket notification setting; canonical IT rules remain authoritative."},
 {key:"email_digest_opt_in",title:"Email digest consent",help:"Records opt-in only; no digest is sent until a separate provider workflow is authorized."},
 {key:"share_read_receipts",title:"Read receipt sharing consent",help:"Records preference only. Colleagues cannot access your cursor from this screen."},
 {key:"reduce_motion",title:"Reduce interface motion",help:"Saved to the current Office identity, and applied on this device immediately."},
];
export function OfficeConnectSettings(){
 const [preferences,setPreferences]=useState<ConnectPreferences>({showUnread:true,showMentions:true});
 const [theme,setTheme]=useState<Theme>("light");
 const [ready,setReady]=useState(false);
 const [server,setServer]=useState<ConnectPrefs|null>(null);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [refresh,setRefresh]=useState(0);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  const frame=window.requestAnimationFrame(()=>{
   setPreferences(readConnectPreferences());
   try{setTheme(window.localStorage.getItem(themeKey)==="dark"?"dark":"light");}catch{}
   setReady(true);
  });
  return()=>window.cancelAnimationFrame(frame);
 },[]);
 useEffect(()=>{
  let active=true;
  void fetch("/api/office-chat/preferences",{cache:"no-store",credentials:"same-origin"})
   .then(async response=>{
    const body=await response.json().catch(()=>({})) as ServerAnswer;
    if(!response.ok||body.scope!=="OWN"||!body.preferences)throw Error(body.detail||"Personal settings unavailable");
    return body;
   }).then(body=>{if(active){
    setServer(body.preferences);setError("");
    // The canonical identity preference is mirrored locally for fast and
    // accessible rendering by OfficeAppearanceRoot after page navigation.
    saveMotionMode(body.preferences.reduce_motion?"reduced":"system");
   }}).catch(e=>{if(active){setServer(null);setError(e instanceof Error?e.message:"Personal settings unavailable");}})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[refresh]);
 function updatePreference(key:keyof ConnectPreferences,checked:boolean){
  const next={...preferences,[key]:checked};
  setPreferences(next);saveConnectPreferences(next);
  setNotice("Presentation preference updated on this device only.");
 }
 function updateTheme(next:Theme){
  setTheme(next);
  try{window.localStorage.setItem(themeKey,next);}catch{}
  window.dispatchEvent(new CustomEvent("kravia-office-theme-change",{detail:next}));
  setNotice("Theme updated on this device for Office and Finance.");
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!server||saving)return;setSaving(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/office-chat/preferences",{method:"PUT",credentials:"same-origin",
     headers:{"Content-Type":"application/json"},body:JSON.stringify(server)});
   const body=await response.json().catch(()=>({})) as ServerAnswer;
   if(!response.ok||body.scope!=="OWN"||!body.preferences)throw Error(body.detail||"Changes were not confirmed");
   setServer(body.preferences);
   saveMotionMode(body.preferences.reduce_motion?"reduced":"system");
   window.dispatchEvent(new CustomEvent("kravia-connect-preferences-change",
    {detail:{reduce_motion:body.preferences.reduce_motion}}));
   setNotice("Personal preferences saved to your verified Office identity. No external email was sent.");
  }catch(e){setError(e instanceof Error?e.message:"Settings were not saved");}
  finally{setSaving(false);}
 }
 return <section className={styles.shell} aria-label="Connect personal preferences">
  <Link href="/office/chat" className={styles.back}><ArrowLeft size={16} aria-hidden="true"/>Connect</Link>
  <header><p className={styles.eyebrow}>KRAVIA CONNECT · PERSONAL CONTROLS</p>
   <h1>Preferences</h1><p>Identity-backed notification consent and device-local presentation. Company access, delivery and approval policies remain separate.</p>
  </header>
  {error?<p className={styles.notice} role="alert">{error}
   <button type="button" disabled={loading||saving} onClick={()=>{setLoading(true);setRefresh(x=>x+1);}}>Retry</button></p>:null}
  {notice?<p className={styles.notice} role="status">{notice}</p>:null}
  <div className={styles.columns}>
   <section className={styles.card} aria-labelledby="connect-device-heading">
    <h2 id="connect-device-heading"><Monitor size={19} aria-hidden="true"/> Device presentation</h2>
    {!ready?<p role="status">Loading device preferences…</p>:<><p>These controls change your current screen, not notification delivery or legal records.</p>
     <label className={styles.switch}><span><strong>Show unread messages</strong>
      <small>Show the unread count on Connect home.</small></span>
      <input type="checkbox" checked={preferences.showUnread}
        onChange={event=>updatePreference("showUnread",event.target.checked)}/></label>
     <label className={styles.switch}><span><strong>Show mentions shortcut</strong>
      <small>Mentions remain accessible even when the shortcut is hidden.</small></span>
      <input type="checkbox" checked={preferences.showMentions}
        onChange={event=>updatePreference("showMentions",event.target.checked)}/></label>
     <div className={styles.options} role="group" aria-label="Workspace colour theme">
      <button type="button" aria-pressed={theme==="light"} data-selected={theme==="light"}
       onClick={()=>updateTheme("light")}><Sun size={18}/>Light</button>
      <button type="button" aria-pressed={theme==="dark"} data-selected={theme==="dark"}
       onClick={()=>updateTheme("dark")}><Moon size={18}/>Dark</button>
     </div></>}
   </section>
   <section className={styles.card} aria-labelledby="connect-server-heading">
    <h2 id="connect-server-heading"><Bell size={19} aria-hidden="true"/> Identity-backed preferences</h2>
    <p>Personal choices are stored in the separate, access-controlled Office preference ledger. Only authorized notification systems can act on them.</p>
    {loading?<p role="status" aria-busy="true">Loading your verified preferences…</p>:null}
    {!loading&&server?<form className={styles.serverForm} onSubmit={save}>
     {fields.map(field=><label className={styles.switch} key={field.key}>
       <span><strong>{field.title}</strong><small>{field.help}</small></span>
       <input type="checkbox" checked={server[field.key]} disabled={saving}
        onChange={event=>setServer(current=>current?{...current,[field.key]:event.target.checked}:current)}/>
      </label>)}
      <button type="submit" disabled={saving}>{saving?"Saving…":"Save verified preferences"}</button>
    </form>:null}
   </section>
   <section className={styles.card} aria-labelledby="connect-policy-heading">
    <h2 id="connect-policy-heading"><ShieldCheck size={19} aria-hidden="true"/> Delivery and privacy boundaries</h2>
    <p>Settings indicate consent. They do not authorize external delivery, expose conversation history, create a group membership or change access rights.</p>
    <div className={styles.policy}><EyeOff size={18}/><span><strong>Other employees' read receipts</strong>
      <small>Not exposed to this settings page or organization-wide administration.</small></span></div>
    <div className={styles.policy}><Mail size={18}/><span><strong>Email digests</strong>
      <small>Consent can be stored but the delivery workflow requires separate provider verification and approval.</small></span></div>
    <div className={styles.policy}><Eye size={18}/><span><strong>Trusted identity</strong>
      <small>Sessions, roles, MFA and employee availability are managed by Office authority.</small></span></div>
    <Link href="/office/notifications" className={styles.link}>Canonical notifications <ArrowRight size={16}/></Link>
    <Link href="/office/settings" className={styles.link}>Office security settings <ArrowRight size={16}/></Link>
    <Link href="/office/privacy" className={styles.link}>Privacy policy register <ArrowRight size={16}/></Link>
   </section>
  </div>
  <p className={styles.footer}><ShieldCheck size={16} aria-hidden="true"/>No automatic email, peer-receipt publication, authority grant or policy change.</p>
 </section>;
}
