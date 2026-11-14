"use client";
import {useEffect,useState,type ReactNode} from "react";
import styles from "./office-connect-preferences-root.module.css";
export function OfficeConnectPreferencesRoot({children}:{children:ReactNode}){
 const [reduced,setReduced]=useState(false);
 useEffect(()=>{
  let active=true;
  void fetch("/api/office-chat/preferences",{credentials:"same-origin",cache:"no-store"})
   .then(async r=>{if(!r.ok)throw Error("Preferences unavailable");return r.json();})
   .then((body:{preferences?:{reduce_motion?:boolean}})=>{
    if(active)setReduced(body.preferences?.reduce_motion===true);
   }).catch(()=>{});
  function handle(event:Event){
   const details=(event as CustomEvent<{reduce_motion?:boolean}>).detail;
   setReduced(details?.reduce_motion===true);
  }
  window.addEventListener("kravia-connect-preferences-change",handle);
  return()=>{active=false;window.removeEventListener("kravia-connect-preferences-change",handle);};
 },[]);
 return <div className={styles.root} data-reduced-motion={reduced}>{children}</div>;
}
