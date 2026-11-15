"use client";

import {useEffect,useState} from "react";
import {BellRing,CheckCircle2,LoaderCircle,Play,ShieldCheck,Volume2} from "lucide-react";
import {
  defaultNotificationPreferences,notificationCategories,
  type OfficeNotificationPreferences,type OfficeNotificationSound,
} from "@/lib/office/notification-types";
import styles from "./office-notification-preferences-panel.module.css";

const labels={chat:"Connect messages and mentions",support:"Support and IT",
  department:"Interdepartmental requests",approval:"Approvals and decisions",
  hr:"HR and attendance",finance:"Finance and payroll",
  vault:"K-Vault access",system:"Company and security"};
const profiles: Array<{id:OfficeNotificationSound;label:string;use:string}> = [
  {id:"orbit",label:"Orbit",use:"Messages and general updates"},
  {id:"prism",label:"Prism",use:"Approval decisions"},
  {id:"flux",label:"Flux",use:"Department and support requests"},
  {id:"beacon",label:"Beacon",use:"Critical alerts"},
];

export function OfficeNotificationPreferencesPanel() {
  const [prefs,setPrefs]=useState<OfficeNotificationPreferences>(defaultNotificationPreferences);
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    let alive=true;
    void fetch("/api/office-notifications/preferences",{cache:"no-store",credentials:"same-origin"})
      .then(async response=>{
        const data=await response.json();
        if(!response.ok)throw new Error(data.detail??"Notification settings unavailable");
        if(alive){setPrefs({...defaultNotificationPreferences,...data,
          categories:{...defaultNotificationPreferences.categories,...data.categories}});setLoaded(true);}
      }).catch(error=>{if(alive){setError(error instanceof Error?error.message:"Unable to load settings");setLoaded(true);}});
    return()=>{alive=false;};
  },[]);

  async function save(next:OfficeNotificationPreferences) {
    setBusy(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/office-notifications/preferences",{
        method:"PUT",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify(next),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.detail??"Notification settings not saved");
      setPrefs(next);setNotice("Notification preferences saved");
      window.dispatchEvent(new CustomEvent("kravia-notification-preferences",{detail:next}));
    }catch(error){setError(error instanceof Error?error.message:"Unable to save notification settings");}
    finally{setBusy(false);}
  }

  async function enableBrowser() {
    if(!("Notification" in window)){setError("Browser notifications are not supported in this environment");return;}
    try{
      const permission=await Notification.requestPermission();
      if(permission!=="granted"){setError("Browser notifications were not allowed; Office alerts remain available");return;}
      await save({...prefs,browser_enabled:true});
    }catch{setError("Browser notification permission could not be requested");}
  }

  async function testSound(id:OfficeNotificationSound) {
    try{
      const sound=new Audio("/api/office-notifications/sound/"+id);
      sound.volume=Math.max(0,Math.min(1,prefs.volume));
      await sound.play();
    }catch{setError("Audio playback was blocked. Tap a sound again after interacting with the page.");}
  }

  if(!loaded)return <div className={styles.loading} role="status"><LoaderCircle size={17}/>Loading your preferences…</div>;
  return <section className={styles.shell} aria-label="Unified notification preferences">
    <div className={styles.intro}>
      <div><h3>Live alerts & notifications</h3><p>Applies to Connect, support, departments, approvals and your assigned company records.</p></div>
      <BellRing size={19} aria-hidden="true"/>
    </div>
    {error?<p className={styles.error} role="alert">{error}</p>:null}
    {notice?<p className={styles.notice} role="status"><CheckCircle2 size={16}/>{notice}</p>:null}
    <div className={styles.option}>
      <div><strong>Play KRAVIA sounds</strong><small>Off until you enable it. Requires permitted browser audio playback.</small></div>
      <input type="checkbox" checked={prefs.sound_enabled} disabled={busy}
        onChange={event=>void save({...prefs,sound_enabled:event.target.checked})}
        aria-label="Enable KRAVIA notification sounds"/>
    </div>
    <div className={styles.option}>
      <div><strong>Browser notifications</strong><small>Shows a system notification when another browser tab is active, if the browser permits it.</small></div>
      {prefs.browser_enabled?
        <button type="button" disabled={busy} onClick={()=>void save({...prefs,browser_enabled:false})}>Disable</button>:
        <button type="button" disabled={busy} onClick={()=>void enableBrowser()}>Enable</button>}
    </div>
    <div className={styles.option}>
      <div><strong>Sound volume</strong><small>{Math.round(prefs.volume*100)}% of the source sound level</small></div>
      <input type="range" min="0" max="1" step=".05" value={prefs.volume} disabled={busy}
        aria-label="Notification sound volume"
        onChange={event=>setPrefs(p=>({...p,volume:Number(event.target.value)}))}
        onPointerUp={()=>void save(prefs)}
        onKeyUp={()=>void save(prefs)} />
    </div>
    <div className={styles.soundGrid}>
      {profiles.map(profile=><button key={profile.id} type="button"
        className={styles.sound} onClick={()=>void testSound(profile.id)}>
        <Play size={15} aria-hidden="true"/>
        <span><strong>{profile.label}</strong><small>{profile.use}</small></span>
      </button>)}
    </div>
    <div className={styles.option}>
      <div><strong>Quiet hours</strong><small>Suppresses noncritical popups and sounds during the selected IST window.</small></div>
      <input type="checkbox" checked={prefs.quiet_enabled} disabled={busy}
        onChange={event=>void save({...prefs,quiet_enabled:event.target.checked})}
        aria-label="Enable notification quiet hours"/>
    </div>
    {prefs.quiet_enabled?<div className={styles.times}>
      <label>Quiet from <input type="time" value={prefs.quiet_start}
        onChange={event=>void save({...prefs,quiet_start:event.target.value})}/></label>
      <label>Quiet until <input type="time" value={prefs.quiet_end}
        onChange={event=>void save({...prefs,quiet_end:event.target.value})}/></label>
    </div>:null}
    <div className={styles.categories}>
      <strong>Event categories</strong>
      {notificationCategories.map(category=><label key={category}>
        <span>{labels[category]}</span>
        <input type="checkbox" checked={prefs.categories[category]} disabled={busy}
          onChange={event=>void save({...prefs,categories:{...prefs.categories,[category]:event.target.checked}})}/>
      </label>)}
    </div>
    <p className={styles.safety}><ShieldCheck size={16} aria-hidden="true"/>
      Mandatory security and legal records remain in the authorized inbox. Preferences change interruptions, not company permissions.</p>
  </section>;
}
