"use client";

import {useEffect,useRef,useState,useCallback} from "react";
import {createPortal} from "react-dom";
import Link from "next/link";
import {ArrowUpRight,Bell,BellRing,CheckCheck,X} from "lucide-react";
import {useOfficeWorkspace} from "@/components/office-workspace-context";
import {
  defaultNotificationPreferences,inQuietHours,notificationCategory,
  notificationSound,safeNotificationHref,
  type OfficeNotice,type OfficeNotificationPreferences,
} from "@/lib/office/notification-types";
import styles from "./office-notification-hub.module.css";

type Center={unread:number;notifications:OfficeNotice[]};
type StateMessage={type:"refetch";user:string};
const POLL_MS=8000;
function toastDelay(item:OfficeNotice){
  return item.priority==="CRITICAL"?0:item.priority==="HIGH"?10000:7000;
}
function soundFor(item:OfficeNotice,pref:OfficeNotificationPreferences){
  if(!pref.sound_enabled)return;
  try{
    const clip=new Audio("/api/office-notifications/sound/"+notificationSound(item));
    clip.volume=Math.max(0,Math.min(1,pref.volume));
    void clip.play().catch(()=>{ /* Browsers require prior interaction to play audio. */ });
  }catch{ /* Muting is safer than failing a notification. */ }
}

export function OfficeNotificationHub(){
  const {identity}=useOfficeWorkspace();
  const [data,setData]=useState<Center|null>(null);
  const [pref,setPref]=useState<OfficeNotificationPreferences>(defaultNotificationPreferences);
  const [open,setOpen]=useState(false);
  const [toasts,setToasts]=useState<OfficeNotice[]>([]);
  const [portal,setPortal]=useState<HTMLElement|null>(null);
  const [error,setError]=useState("");
  const prefRef=useRef(pref);
  const previous=useRef<Map<string,string>|null>(null);
  const queue=useRef<OfficeNotice[]>([]);
  const pending=useRef(false);
  const bc=useRef<BroadcastChannel|null>(null);
  const triggerRef=useRef<HTMLDivElement>(null);
  const flyoutRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{prefRef.current=pref;},[pref]);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>setPortal(document.body));
    return()=>cancelAnimationFrame(frame);
  },[]);
  useEffect(()=>{
    let alive=true;
    void fetch("/api/office-notifications/preferences",{cache:"no-store",credentials:"same-origin"})
      .then(async response=>{
        if(!response.ok)throw new Error("Preferences unavailable");
        const parsed=await response.json();
        if(alive)setPref({...defaultNotificationPreferences,...parsed,
          categories:{...defaultNotificationPreferences.categories,...parsed.categories}});
      }).catch(()=>{});
    const onPref=(e:Event)=>{
      const next=(e as CustomEvent<OfficeNotificationPreferences>).detail;
      if(next && alive)setPref(next);
    };
    window.addEventListener("kravia-notification-preferences",onPref);
    return()=>{alive=false;window.removeEventListener("kravia-notification-preferences",onPref);};
  },[]);

  const dismiss=useCallback((id:string)=>{
    setToasts(current=>{
      const next=current.filter(item=>item.id!==id);
      while(next.length<3&&queue.current.length)next.push(queue.current.shift()!);
      return next;
    });
  },[]);

  const refresh=useCallback(async()=>{
    if(pending.current)return;
    pending.current=true;
    try{
      const response=await fetch("/api/office-notifications",{cache:"no-store",credentials:"same-origin"});
      if(!response.ok)throw Error("Notification inbox unavailable");
      const next=await response.json() as Center;
      if(!Array.isArray(next.notifications))throw Error("Notification response invalid");
      setData(next);setError("");
      const snapshot=new Map(next.notifications.map(item=>[item.id,item.status]));
      const old=previous.current;
      previous.current=snapshot;
      if(!old)return; // Do not interrupt with pre-existing notifications on initial load.
      const fresh=next.notifications.filter(item=>item.status==="UNREAD"&&!old.has(item.id));
      for(const notice of fresh.reverse()){
        const cat=notificationCategory(notice.kind);
        // Connect already shows this conversation's messages and unread counts.
        // Suppress redundant floating toasts while the user is looking at Connect;
        // the notification remains in the durable Office inbox.
        if(cat==="chat"&&window.location.pathname.startsWith("/office/chat")
           &&document.visibilityState==="visible"&&document.hasFocus())continue;
        const selected=prefRef.current;
        if(!selected.categories[cat])continue;
        const critical=notice.priority==="CRITICAL";
        if(inQuietHours(selected)&&!critical)continue;
        const claim="kravia.office.alert."+identity.userId+"."+notice.id;
        const now=Date.now();
        try{
          const previousClaim=Number(localStorage.getItem(claim)||0);
          if(previousClaim&&now-previousClaim<300000)continue;
          localStorage.setItem(claim,String(now));
        }catch{ /* A private tab may have no shared storage. */ }
        if(document.visibilityState==="visible"&&document.hasFocus()){
          queue.current.push(notice);
          setToasts(current=>{
            const next=[...current];
            while(next.length<3&&queue.current.length)next.push(queue.current.shift()!);
            return next;
          });
          soundFor(notice,selected);
        }else if(selected.browser_enabled&&typeof Notification!=="undefined"&&Notification.permission==="granted"){
          try{
            const native=new Notification("KRAVIA Office",{body:"A private company notification is waiting in KRAVIA Office.",tag:notice.id,icon:"/icon.png"});
            native.onclick=()=>{
              window.focus();
              window.location.assign(safeNotificationHref(notice.target_path));
              native.close();
            };
          }catch{ /* Native notification delivery is best-effort in background tabs. */ }
        }
      }
    }catch{
      setError("Notifications unavailable");
    }finally{pending.current=false;}
  },[identity.userId]);

  useEffect(()=>{
    const frame=requestAnimationFrame(()=>void refresh());
    const interval=setInterval(()=>void refresh(),POLL_MS);
    const onVisibility=()=>void refresh();
    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("focus",onVisibility);
    const channel=typeof BroadcastChannel!=="undefined"
      ?new BroadcastChannel("kravia-office-unified-alerts"):null;
    bc.current=channel;
    if(channel)channel.onmessage=message=>{
      const event=message.data as StateMessage;
      if(event?.type==="refetch"&&event.user===identity.userId&&document.visibilityState==="visible")
        void refresh();
    };
    return()=>{
      cancelAnimationFrame(frame);clearInterval(interval);
      document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("focus",onVisibility);
      channel?.close();bc.current=null;
    };
  },[identity.userId,refresh]);

  useEffect(()=>{
    if(!("EventSource" in window))return;
    let stream:EventSource|null=null;
    const start=()=>{
      stream?.close();stream=null;
      if(document.visibilityState!=="visible")return;
      stream=new EventSource("/api/office-notifications/events",{withCredentials:true});
      stream.addEventListener("change",()=>void refresh());
      stream.addEventListener("unavailable",()=>stream?.close());
    };
    const frame=requestAnimationFrame(start);
    document.addEventListener("visibilitychange",start);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener("visibilitychange",start);stream?.close();};
  },[refresh]);

  useEffect(()=>{
    if(!toasts.length)return;
    const timers=toasts.filter(t=>toastDelay(t)>0).map(t=>
      setTimeout(()=>dismiss(t.id),toastDelay(t)));
    return()=>timers.forEach(clearTimeout);
  },[toasts,dismiss]);

  useEffect(()=>{
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("keydown",closeOnEscape);
    return()=>document.removeEventListener("keydown",closeOnEscape);
  },[]);

  async function markRead(id:string) {
    try{
      await fetch("/api/office-notifications",{
        method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"READ",notification_id:id}),
      });
      bc.current?.postMessage({type:"refetch",user:identity.userId} satisfies StateMessage);
      void refresh();
    }catch{}
  }

  useEffect(()=>{
    if(!open)return;
    const closeOutside=(event:PointerEvent)=>{
      if(event.target instanceof Node
        && !triggerRef.current?.contains(event.target)
        && !flyoutRef.current?.contains(event.target))setOpen(false);
    };
    document.addEventListener("pointerdown",closeOutside);
    return()=>document.removeEventListener("pointerdown",closeOutside);
  },[open]);

  const unread=data?.unread??0;
  const inbox=data?.notifications.slice(0,12)??[];
  return <div className={styles.wrapper} ref={triggerRef}>
    <button type="button" className={styles.trigger} title="Notifications"
      aria-label={"Open Office notifications"+(unread?" ("+unread+" unread)":"")}
      aria-expanded={open} aria-haspopup="dialog"
      onClick={()=>{setOpen(v=>!v);void refresh();}}>
      <Bell size={19} aria-hidden="true"/>
      {unread>0?<span className={styles.count}>{unread>99?"99+":unread}</span>:null}
    </button>
    {open && portal ? createPortal(<div className={styles.flyout} ref={flyoutRef} role="dialog" aria-label="Office notification inbox">
      <header><span><BellRing size={16}/>Notifications</span>
        <Link href="/office/notifications" onClick={()=>setOpen(false)}>View all <ArrowUpRight size={14}/></Link>
        <button type="button" aria-label="Close notifications" onClick={()=>setOpen(false)}><X size={16}/></button>
      </header>
      {error?<p className={styles.error}>{error}</p>:null}
      <div className={styles.flyoutList}>{inbox.length?inbox.map(item=>
        <Link key={item.id} href={safeNotificationHref(item.target_path)}
          data-unread={item.status==="UNREAD"}
          onClick={()=>{setOpen(false);void markRead(item.id);}}>
          <strong>{item.title}</strong><small>{item.body}</small>
        </Link>
      ):<p>No notifications to display</p>}</div>
      <footer><CheckCheck size={14}/> All alerts remain available in your private Notification Center.</footer>
    </div>,portal):null}

    {portal?createPortal(<div className={styles.toastLayer} aria-label="Floating Office notifications">
      {toasts.map(item=><article className={styles.toast} key={item.id}
        role={item.priority==="CRITICAL"?"alert":"status"}
        data-priority={item.priority??"NORMAL"}>
        <div className={styles.toastIcon}><BellRing size={19}/></div>
        <div className={styles.toastBody}>
          <small>KRAVIA OFFICE · {notificationCategory(item.kind).toUpperCase()}</small>
          <strong>{item.title}</strong>
          <p>{item.body}</p>
          <Link href={safeNotificationHref(item.target_path)}
            onClick={()=>{dismiss(item.id);void markRead(item.id);}}>
            Open <ArrowUpRight size={14}/>
          </Link>
        </div>
        <button type="button" className={styles.toastClose}
          aria-label="Dismiss floating notification" onClick={()=>dismiss(item.id)}>
          <X size={17}/>
        </button>
      </article>)}
    </div>,portal):null}
  </div>;
}
