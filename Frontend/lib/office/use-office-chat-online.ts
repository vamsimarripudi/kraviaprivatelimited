"use client";
import {useEffect,useRef,useState} from "react";
type MemberPresence={user_id:string;online:boolean;last_seen_at:string|null};
type ConversationPresence={members:MemberPresence[];as_of:string};

/** Chat-only device leases, never workforce attendance or payroll evidence. */
export function useOfficeChatOnline(conversationId:string|undefined,revision:number){
 const [snapshot,setSnapshot]=useState<{id:string;members:MemberPresence[]}|null>(null);
 // Presence leases run once for every authorized Office workspace tab.
 // This hook subscribes only to currently authorized conversation visibility.
 const refreshRef=useRef<()=>void>(()=>{});
 const previousConversation=useRef<string|undefined>(undefined);
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
 return snapshot && snapshot.id===conversationId ? snapshot.members : [];
}
