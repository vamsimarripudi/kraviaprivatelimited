"use client";
import {useEffect,useRef,useState} from "react";
export type OfficeInboxLiveState="idle"|"live"|"reconnecting"|"restricted"|"polling";
export function useOfficeChatInboxLive(onChange:()=>void):OfficeInboxLiveState{
 const [state,setState]=useState<OfficeInboxLiveState>("idle");
 const callback=useRef(onChange);
 useEffect(()=>{callback.current=onChange;},[onChange]);
 useEffect(()=>{
  if(typeof EventSource==="undefined"){return;}
  let active=true,blocked=false,stream:EventSource|null=null;
  let debounce:ReturnType<typeof setTimeout>|undefined;
  const connect=()=>{
   if(!active||blocked||document.visibilityState!=="visible")return;
   const next=new EventSource("/api/office-chat/inbox/events",{withCredentials:true});
   stream=next;
   next.addEventListener("ready",()=>{
    if(!active)return;
    setState("live");callback.current();
   });
   next.addEventListener("change",()=>{
    if(!active||document.visibilityState!=="visible")return;
    if(debounce)clearTimeout(debounce);
    debounce=setTimeout(()=>{if(active)callback.current();},240);
   });
   next.addEventListener("access-revoked",()=>{
    blocked=true;next.close();setState("restricted");callback.current();
   });
   next.addEventListener("unavailable",()=>{if(active)setState("polling");});
   next.onerror=()=>{if(active&&!blocked)setState("reconnecting");};
  };
  const visibility=()=>{
   stream?.close();stream=null;
   if(document.visibilityState==="visible"){connect();callback.current();}
  };
  const frame=requestAnimationFrame(connect);
  const fallback=setInterval(()=>{
   if(active&&document.visibilityState==="visible")callback.current();
  },20000);
  document.addEventListener("visibilitychange",visibility);
  return()=>{
   active=false;cancelAnimationFrame(frame);clearInterval(fallback);
   document.removeEventListener("visibilitychange",visibility);
   if(debounce)clearTimeout(debounce);
   stream?.close();
  };
 },[]);
 return state;
}
