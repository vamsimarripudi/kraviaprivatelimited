"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,Bell,Eye,EyeOff,Mail,Monitor, Moon, ShieldCheck, Sun, VolumeX} from "lucide-react";
import {readConnectPreferences,readMotionMode,saveConnectPreferences,saveMotionMode,
 type ConnectPreferences,type MotionMode} from "@/lib/office/connect-preferences";
import styles from "./office-connect-settings.module.css";
const themeKey="kravia.office.appearance";
type Theme="light"|"dark";
export function OfficeConnectSettings(){
 const [preferences,setPreferences]=useState<ConnectPreferences>({showUnread:true,showMentions:true});
 const [theme,setTheme]=useState<Theme>("light");
 const [motion,setMotion]=useState<MotionMode>("system");
 const [ready,setReady]=useState(false);
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  const frame=window.requestAnimationFrame(()=>{
   setPreferences(readConnectPreferences());
   setMotion(readMotionMode());
   try{setTheme(window.localStorage.getItem(themeKey)==="dark"?"dark":"light");}catch{}
   setReady(true);
  });
  return()=>window.cancelAnimationFrame(frame);
 },[]);
 function updatePreference(key:keyof ConnectPreferences,checked:boolean){
  const next={...preferences,[key]:checked};
  setPreferences(next);saveConnectPreferences(next);
  setNotice("Display preference updated on this device. Server notifications remain unchanged.");
 }
 function updateMotion(next:MotionMode){
  setMotion(next);saveMotionMode(next);
  setNotice("Motion preference updated for Office and Finance on this device.");
 }
 function updateTheme(next:Theme){
  setTheme(next);
  try{window.localStorage.setItem(themeKey,next);}catch{}
  window.dispatchEvent(new CustomEvent("kravia-office-theme-change",{detail:next}));
  setNotice("Theme updated for Office and Finance on this device.");
 }
 return <section className={styles.shell} aria-label="Connect personal preferences">
  <Link href="/office/chat" className={styles.back}><ArrowLeft size={16} aria-hidden="true"/>Connect</Link>
  <header><p className={styles.eyebrow}>KRAVIA CONNECT · PERSONAL CONTROLS</p>
   <h1>Preferences</h1><p>Presentation settings for your device. Account security, mail consent and delivery remain controlled by Office policies.</p>
  </header>
  {!ready?<p role="status" aria-busy="true">Loading device preferences…</p>:null}
  {ready?<div className={styles.columns}>
   <section className={styles.card} aria-labelledby="connect-display-heading">
    <h2 id="connect-display-heading"><Bell size={19} aria-hidden="true"/> In-app presentation</h2>
    <p>Choose which shortcuts and statistics appear on your Connect home. Messages, assignments, and mandatory alerts are never deleted or suppressed.</p>
    <label className={styles.switch}>
     <span><strong>Show unread message count</strong><small>Hide the unread number on the Connect home KPI card only.</small></span>
     <input type="checkbox" checked={preferences.showUnread}
      onChange={event=>updatePreference("showUnread",event.target.checked)}/>
    </label>
    <label className={styles.switch}>
     <span><strong>Show mentions shortcut</strong><small>Mentions remain available in the message index even when this shortcut is hidden.</small></span>
     <input type="checkbox" checked={preferences.showMentions}
      onChange={event=>updatePreference("showMentions",event.target.checked)}/>
    </label>
    <Link href="/office/notifications" className={styles.link}>Canonical Office notifications <ArrowRight size={16}/></Link>
   </section>
   <section className={styles.card} aria-labelledby="connect-theme-heading">
    <h2 id="connect-theme-heading"><Monitor size={19} aria-hidden="true"/> Appearance</h2>
    <p>Theme applies only to Office and Finance. It is saved on this device, not to your company access profile.</p>
    <div className={styles.options} role="group" aria-label="Workspace colour theme">
     <button type="button" aria-pressed={theme==="light"} data-selected={theme==="light"}
      onClick={()=>updateTheme("light")}><Sun size={18}/>Light</button>
     <button type="button" aria-pressed={theme==="dark"} data-selected={theme==="dark"}
      onClick={()=>updateTheme("dark")}><Moon size={18}/>Dark</button>
    </div>
    <h3><VolumeX size={17} aria-hidden="true"/> Motion and animation</h3>
    <fieldset className={styles.motion}><legend>Animation preference</legend>
     {([["system","Follow device accessibility setting"],["reduced","Reduce animation"],["full","Use standard animation"]] as const)
       .map(([value,label])=><label key={value}>
       <input type="radio" name="connect-motion" checked={motion===value}
        onChange={()=>updateMotion(value)}/>{label}</label>)}
    </fieldset>
   </section>
   <section className={styles.card} aria-labelledby="connect-policy-heading">
    <h2 id="connect-policy-heading"><ShieldCheck size={19} aria-hidden="true"/> Privacy and delivery</h2>
    <p>Read-receipt sharing and external email digests are not editable from Connect until a verified organization policy and delivery adapter explicitly enable them.</p>
    <div className={styles.policy}><EyeOff size={18}/><span><strong>Other employees' read receipts</strong>
     <small>Not exposed by the current private messaging service. Your unread cursor remains private.</small></span></div>
    <div className={styles.policy}><Mail size={18}/><span><strong>Email digest</strong>
     <small>Not configured in Connect. No email subscription or external message is created here.</small></span></div>
    <div className={styles.policy}><Eye size={18}/><span><strong>Company-managed identity status</strong>
     <small>Attendance, availability, role and trusted devices use the canonical Office controls.</small></span></div>
    <Link className={styles.link} href="/office/settings">Open Office security and account settings <ArrowRight size={16}/></Link>
    <Link className={styles.link} href="/office/privacy">Privacy and policy register <ArrowRight size={16}/></Link>
   </section>
  </div>:null}
  {notice?<p className={styles.notice} role="status">{notice}</p>:null}
  <p className={styles.footer}><ShieldCheck size={16} aria-hidden="true"/>No modification to server-side IAM, notifications, read receipts, legal holds, or external email delivery.</p>
 </section>;
}
