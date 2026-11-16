"use client";
import {useEffect,useRef} from "react";
/** Revalidate only the mounted, visible module via its existing authorized API.
 * Avoid polling all departments and never overwrite an active form/dialog. */
export function useOfficeLiveRefresh(reload:()=>Promise<unknown>,opts:{paused?:boolean;intervalMs?:number}={}){
 const fn=useRef(reload);
 useEffect(()=>{fn.current=reload;},[reload]);
 const busy=useRef(false);
 const paused=Boolean(opts.paused),delay=Math.max(15000,opts.intervalMs??45000);
 useEffect(()=>{
  if(paused)return;
  let disposed=false;
  const sync=()=>{
   if(disposed||busy.current||document.visibilityState!=="visible")return;
   const focus=document.activeElement;
   if(focus instanceof HTMLElement&&focus.closest("form,[role='dialog'],[contenteditable='true']"))return;
   busy.current=true;
   void Promise.resolve().then(()=>fn.current()).catch(()=>{/* Each module handles its own error UI. */})
    .finally(()=>{busy.current=false;});
  };
  const timer=window.setInterval(sync,delay);
  window.addEventListener("focus",sync);document.addEventListener("visibilitychange",sync);
  window.addEventListener("kravia-office-live-change",sync);
  return()=>{disposed=true;window.clearInterval(timer);window.removeEventListener("focus",sync);
   document.removeEventListener("visibilitychange",sync);window.removeEventListener("kravia-office-live-change",sync);
  };
 },[paused,delay]);
}
