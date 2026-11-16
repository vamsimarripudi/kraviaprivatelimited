"use client";
import {useEffect} from "react";

// A unique ID per browser tab; not reused across independently opened devices.
let tabDeviceId:string|null=null;
function deviceId(){
 if(!tabDeviceId)tabDeviceId=window.crypto.randomUUID();
 return tabDeviceId;
}
/** Office-wide chat presence, independent of the currently viewed department. */
export function OfficeChatOnlineHeartbeat(){
 useEffect(()=>{
  const device=deviceId();
  const pulse=(online:boolean)=>{
   void fetch("/api/office-chat/presence",{
    method:"POST",credentials:"same-origin",cache:"no-store",keepalive:true,
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({device_id:device,online}),
   }).catch(()=>{/* Expiring server leases recover safely from disconnects. */});
  };
  const visibility=()=>pulse(document.visibilityState==="visible");
  const disconnect=()=>pulse(false);
  const frame=requestAnimationFrame(visibility);
  const timer=window.setInterval(()=>{
   if(document.visibilityState==="visible")pulse(true);
  },22000);
  document.addEventListener("visibilitychange",visibility);
  window.addEventListener("pagehide",disconnect);
  return()=>{
   cancelAnimationFrame(frame);window.clearInterval(timer);
   document.removeEventListener("visibilitychange",visibility);
   window.removeEventListener("pagehide",disconnect);
   disconnect();
  };
 },[]);
 return null;
}
