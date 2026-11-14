"use client";
import {useEffect,useRef,useState} from "react";
export type OfficeChatLiveStatus="idle"|"connecting"|"live"|"reconnecting"|"polling"|"restricted";
/** First-party SSE: no Supabase service key, browser-stored JWT or file data.
 * The canonical authorized message GET remains the sole content provider.
 * Falls back to the existing 15-second private polling loop on network loss. */
export function useOfficeChatLive(
 conversationId:string|undefined,
 onChange:()=>void,
 onRevoked:()=>void,
):OfficeChatLiveStatus{
 const [status,setStatus]=useState<OfficeChatLiveStatus>("idle");
 const changeRef=useRef(onChange),revokedRef=useRef(onRevoked);
 useEffect(()=>{
  changeRef.current=onChange;
  revokedRef.current=onRevoked;
 },[onChange,onRevoked]);
 useEffect(()=>{
  if(!conversationId){return;}
  if(typeof EventSource==="undefined"){return;}
  let active=true;
  let stream:EventSource|null=null;
  let debounce:ReturnType<typeof setTimeout>|undefined;
  let rejected=false;
  const connect=()=>{
   if(!active||rejected||document.visibilityState==="hidden")return;
   setStatus("connecting");
   const source=new EventSource(
    "/api/office-chat/conversations/"+encodeURIComponent(conversationId)+"/events",
    {withCredentials:true});
   stream=source;
   source.addEventListener("ready",()=>{if(active)setStatus("live");});
   source.addEventListener("change",()=>{
    if(!active||document.visibilityState!=="visible")return;
    if(debounce)clearTimeout(debounce);
    debounce=setTimeout(()=>{if(active)changeRef.current();},200);
   });
   source.addEventListener("access-revoked",()=>{
    if(!active)return;
    rejected=true;setStatus("restricted");source.close();revokedRef.current();
   });
   source.addEventListener("unavailable",()=>{
    if(active)setStatus("polling");
   });
   source.onerror=()=>{if(active&&!rejected)setStatus("reconnecting");};
  };
  const visibility=()=>{
   if(document.visibilityState==="hidden"){
    stream?.close();stream=null;
    setStatus("polling");
   }else{
    stream?.close();stream=null;
    connect();
    changeRef.current();
   }
  };
  // Initial state is changed by the source only after a member-authorized
  // stream has actually connected. An EventSource object is not proof.
  const deferred=window.requestAnimationFrame(connect);
  document.addEventListener("visibilitychange",visibility);
  return()=>{
   active=false;window.cancelAnimationFrame(deferred);
   document.removeEventListener("visibilitychange",visibility);
   if(debounce)clearTimeout(debounce);
   stream?.close();
  };
 },[conversationId]);
 return !conversationId?"idle":status;
}
