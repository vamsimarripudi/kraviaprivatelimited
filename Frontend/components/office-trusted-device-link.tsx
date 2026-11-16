"use client";

import {useCallback,useEffect,useState} from "react";
import {Laptop2,RefreshCw,ShieldCheck,ShieldAlert,Link2,Unlink2} from "lucide-react";
import styles from "./office-trusted-device-link.module.css";

type RegisteredDevice={
 id:string;device_label:string;device_kind:string;platform:string|null;
 trust_state:string;company_managed:boolean;revoked_at:string|null;
 approved_at:string|null;bound_at:string|null;current:boolean;
};
type DevicesResponse={devices:RegisteredDevice[];detail?:string};
async function api(method:"GET"|"POST"|"DELETE",deviceId?:string):Promise<DevicesResponse>{
 const response=await fetch("/api/office-auth/device",{
  method,credentials:"same-origin",cache:"no-store",
  ...(method==="POST"?{
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({device_id:deviceId}),
  }:{}),
 });
 const data=await response.json().catch(()=>({})) as Partial<DevicesResponse>;
 if(!response.ok||!Array.isArray(data.devices))
  throw new Error(typeof data.detail==="string"?data.detail:"Unable to load trusted device state");
 return {devices:data.devices};
}
export function OfficeTrustedDeviceLink(){
 const [items,setItems]=useState<RegisteredDevice[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [desktop,setDesktop]=useState(false);
 const refresh=useCallback(async()=>{
  const result=await api("GET");
  setItems(result.devices);
  setError("");
 },[]);
 useEffect(()=>{
  setDesktop(!/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));
  let live=true;
  void api("GET").then(result=>{if(live){setItems(result.devices);setError("");}})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Device registry unavailable");})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[]);
 const mutate=async(method:"POST"|"DELETE",id?:string)=>{
  setBusy(true);setError("");setNotice("");
  try{
   const result=await api(method,id);
   setItems(result.devices);
   setNotice(method==="POST"?
    "This browser is now bound to the approved company device.":
    "This browser's trusted-device binding was cleared.");
  }catch(e){setError(e instanceof Error?e.message:"Device operation failed");}
  finally{setBusy(false);}
 };
 const mine=items.filter(device=>device.device_kind==="LAPTOP"&&
  (device.trust_state==="PENDING"||device.trust_state==="TRUSTED"));
 const current=items.find(d=>d.current);
 return <section className={styles.panel} aria-label="My company laptop enrollment" data-company-laptop-enrollment>
  <header className={styles.heading}>
   <Laptop2 size={21} aria-hidden="true"/>
   <div><h3>My company laptop</h3>
    <p>Enrollment, approval and browser binding are separate security checks.</p>
   </div>
   <button type="button" className={styles.refresh} disabled={busy||loading}
    aria-label="Refresh device status"
    onClick={()=>{setLoading(true);void refresh().catch(e=>setError(e instanceof Error?e.message:"Device status unavailable")).finally(()=>setLoading(false));}}>
    <RefreshCw size={17} aria-hidden="true"/> Refresh
   </button>
  </header>
  {loading?<p role="status" className={styles.helper}>Checking your registered company devices…</p>:null}
  {error?<p role="alert" className={styles.error}><ShieldAlert size={16} aria-hidden="true"/>{error}</p>:null}
  {notice?<p role="status" className={styles.notice}><ShieldCheck size={16} aria-hidden="true"/>{notice}</p>:null}
  {!loading&&mine.length===0?<p className={styles.helper}>
   No pending laptop enrollment found for this account. Contact KRAVIA IT to register one.</p>:null}
  {!loading&&mine.map(device=>{
   const approved=device.trust_state==="TRUSTED"&&device.company_managed&&!device.revoked_at;
   return <div className={styles.device} key={device.id}>
    <div><strong>{device.device_label}</strong>
     <span>{device.platform||"Platform unverified"} · {device.current?"Bound in this browser":approved?"Awaiting browser binding":"Awaiting security verification"}</span>
    </div>
    <span className={styles.state} data-approved={approved}>
     {device.current?"Bound":approved?"Approved":"Pending"}
    </span>
    {approved&&!device.current&&desktop?<button className={styles.bind} type="button"
       disabled={busy} onClick={()=>void mutate("POST",device.id)}>
       <Link2 size={15} aria-hidden="true"/> Bind this browser
      </button>:null}
   </div>;
  })}
  {current?<button className={styles.unbind} type="button" disabled={busy}
    onClick={()=>void mutate("DELETE")}><Unlink2 size={15} aria-hidden="true"/> Unbind this browser</button>:null}
  <p className={styles.helper}>
   Company approval requires verified disk encryption, screen lock, security protection,
   firewall and patch checks. Binding requires your signed-in, two-factor-verified
   Office session on the actual laptop. It never approves an unverified device.
  </p>
  {!desktop?<p className={styles.helper}>Open this page on the laptop itself to complete browser binding.</p>:null}
 </section>;
}
