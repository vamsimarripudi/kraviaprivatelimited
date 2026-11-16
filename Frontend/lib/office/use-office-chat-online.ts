"use client";
import {useEffect,useRef,useState} from "react";
type MemberPresence={user_id:string;online:boolean;last_seen_at:string|null};
type ConversationPresence={members:MemberPresence[];as_of:string};

/** Chat-only device leases, never workforce attendance or payroll evidence. */
export function useOfficeChatOnline(conversationId:string|undefined,revision:number){
 const [snapshot,setSnapshot]=useState<{id:string;members:MemberPresence[]}|null>(null);
 const device=useRef<string|null>(null);
 const refreshRef=useRef<()=>void>(()=>{});
 const previousConversation=useRef<string|undefined>(undefined);
 useEffect(()=>{
  if(!device.current)device.current=window.crypto.randomUUID();
  const deviceId=device.current;
  const pulse=(online:boolean)=>{
   void fetch("/api/office-chat/presence",{
    method:"POST",credentials:"same-origin",cache:"no-store",keepalive:true,
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({device_id:deviceId,online}),
   }).catch(()=>{/* Expiring lease handles network loss. */});
  };
  const visibility=()=>pulse(document.visibilityState==="visible");
  const frame=requestAnimationFrame(visibility);
  const heartbeat=window.setInterval(()=>{
   if(document.visibilityState==="visible")pulse(true);
  },22000);
  const leaving=()=>pulse(false);
  document.addEventListener("visibilitychange",visibility);
  window.addEventListener("pagehide",leaving);
  return()=>{
   window.cancelAnimationFrame(frame);window.clearInterval(heartbeat);
   document.removeEventListener("visibilitychange",visibility);
   window.removeEventListener("pagehide",leaving);
   pulse(false);
  };
 },[]);
 useEffect(()=>{
  if(!conversationId){
   refreshRef.current=()=>{};
   return;
  }
  let alive=true;
  let inFlight=false;
  const controller=new AbortController();
  const refresh=async()=>{
   if(inFlight)return;
   inFlight=true;
   try{
    const r=await fetch("/api/office-chat/conversations/"+encodeURIComponent(conversationId)+"/presence",{
     credentials:"same-origin",cache:"no-store",signal:controller.signal,
    });
    if(!r.ok)throw Error("Presence unavailable");
    const v=await r.json() as ConversationPresence;
    if(alive&&previousConversation.current===conversationId)
     setSnapshot({id:conversationId,members:Array.isArray(v.members)?v.members:[]});
   }catch{
    if(alive&&!controller.signal.aborted&&previousConversation.current===conversationId)
     setSnapshot({id:conversationId,members:[]});
   }finally{inFlight=false;}
  };
  previousConversation.current=conversationId;
  refreshRef.current=()=>void refresh();
  const frame=requestAnimationFrame(()=>void refresh());
  const interval=window.setInterval(()=>{
   if(document.visibilityState==="visible")void refresh();
  },9000);
  const focus=()=>void refresh();
  window.addEventListener("focus",focus);
  return()=>{
   alive=false;window.cancelAnimationFrame(frame);controller.abort();
   window.clearInterval(interval);window.removeEventListener("focus",focus);
   refreshRef.current=()=>{};
  };
 },[conversationId]);
 useEffect(()=>{
  if(revision>0&&conversationId)refreshRef.current();
 },[conversationId,revision]);
 return snapshot?.id===conversationId?snapshot.members:[];
}
