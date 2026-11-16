"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, ClipboardCheck, Laptop, LockKeyhole, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import styles from "./office-founder-device-recovery.module.css";

type Review = {
  id:string; status:string; reviewer_user_id:string; reviewed_at:string;
  company_managed_verified:boolean; approved_at:string|null;
};
type Posture = {
  checked_at:string;status:string;compromise:boolean;
  encryption:boolean|null;screen_lock:boolean|null;security_agent:boolean|null;
  patch_current:boolean|null;firewall:boolean|null;
};
type Device = {
  id:string;user_id:string;device_label:string;device_kind:string;platform:string|null;
  trust_state:string;company_managed:boolean;bound_at:string|null;revoked_at:string|null;
  reviewer_can_attest:boolean;approver_can_sign:boolean;
  review:Review|null;latest_posture:Posture|null;
};
type Summary = { actor:{id:string;roles:string[]};can_review:boolean;devices:Device[];detail?:string };
type ReviewInput = {
  os_version:string; management_evidence:string; notes:string;
  encryption:boolean;screen_lock:boolean;security_agent:boolean;
  patch_current:boolean;firewall:boolean;no_compromise:boolean;company_managed:boolean;
};
const blank:ReviewInput = {
  os_version:"",management_evidence:"",notes:"",
  encryption:false,screen_lock:false,security_agent:false,
  patch_current:false,firewall:false,no_compromise:false,company_managed:false,
};
const checks = [
  ["encryption","Disk encryption verified"],
  ["screen_lock","Password / Windows Hello screen lock verified"],
  ["security_agent","Defender / endpoint protection healthy"],
  ["patch_current","Current Windows security updates confirmed"],
  ["firewall","Windows Firewall enabled"],
  ["no_compromise","Security scan shows no compromise indicators"],
  ["company_managed","Company ownership/management authority verified"],
] as const;

async function api<T>(body?:Record<string,unknown>):Promise<T> {
  const response=await fetch("/api/office-founder-device-review",{
    method:body?"POST":"GET",
    credentials:"same-origin",cache:"no-store",
    ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{}),
  });
  const data=await response.json().catch(()=>({})) as T & {detail?:string};
  if(!response.ok)throw new Error(typeof data.detail==="string"?data.detail:"Device recovery is temporarily unavailable");
  return data;
}
function when(value:string|null|undefined) {
  if(!value)return "—";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(date);
}

export function OfficeFounderDeviceRecovery({onApproved}:{onApproved?:()=>void}={}) {
  const [state,setState]=useState<Summary|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const [action,setAction]=useState<"REVIEW"|"APPROVE"|null>(null);
  const [form,setForm]=useState<ReviewInput>(blank);
  const [reason,setReason]=useState("");
  const refresh=useCallback(async()=>{
    const result=await api<Summary>();
    setState(result);setError("");
  },[]);
  useEffect(()=>{
    let live=true;
    void api<Summary>().then(result=>{if(live){setState(result);setError("");}})
      .catch(e=>{if(live)setError(e instanceof Error?e.message:"Unable to read security reviews");})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[]);
  const devices=state?.devices??[];
  const current=useMemo(()=>devices.find(d=>d.id===selected)??null,[devices,selected]);
  const approvedReady=Object.values(form).length>0 &&
    checks.every(([key])=>form[key]) &&
    form.os_version.trim().length>=3 &&
    form.management_evidence.trim().length>=12 &&
    form.notes.trim().length>=30;
  function beginReview(device:Device){
    setSelected(device.id);setForm({...blank,os_version:device.platform??""});
    setAction("REVIEW");setReason("");setError("");setNotice("");
  }
  function beginApproval(device:Device){
    setSelected(device.id);setAction("APPROVE");setReason("");setError("");setNotice("");
  }
  async function submit(){
    if(!current||!action)return;
    setBusy(true);setError("");setNotice("");
    try{
      if(action==="REVIEW"){
        if(!approvedReady)throw new Error("Verify every control and add the management evidence and inspection notes");
        await api({
          action:"REVIEW",device_id:current.id,os_version:form.os_version.trim(),
          encryption:true,screen_lock:true,security_agent:true,patch_current:true,firewall:true,
          compromise:false,company_managed:true,
          management_evidence:form.management_evidence.trim(),notes:form.notes.trim(),
        });
        setNotice("Security review recorded. A different Administrator or Director must approve.");
      }else{
        if(!current.review||reason.trim().length<20)throw new Error("Enter an approval reason of at least 20 characters");
        await api({action:"APPROVE",review_id:current.review.id,reason:reason.trim()});
        setNotice("Founder laptop independently approved. Its owner can now bind the laptop browser.");
        window.dispatchEvent(new Event("kravia-office-device-recovery-approved"));
        onApproved?.();
      }
      setAction(null);setSelected(null);
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Device verification failed");}
    finally{setBusy(false);}
  }

  if(!state&&!loading&&error)return <section className={styles.panel} aria-label="Independent device review">
    <div className={styles.intro}><ShieldAlert size={20}/><div>
      <strong>Independent device recovery unavailable</strong><p>{error}</p>
      <small>The reviewed database migration must be deployed before this workflow becomes active.</small>
    </div></div>
    <button type="button" onClick={()=>{setLoading(true);void refresh().finally(()=>setLoading(false));}}>Retry</button>
  </section>;

  return <section className={styles.panel} aria-label="Independent Founder device recovery" data-founder-device-recovery>
    <header className={styles.heading}>
      <div className={styles.symbol}><ShieldCheck size={22} aria-hidden="true"/></div>
      <div><span>COMPANY DEVICE ASSURANCE</span>
        <h3>Founder laptop verification</h3>
        <p>Two-person security review. A revoked device is never trusted automatically.</p>
      </div>
      <button type="button" aria-label="Refresh independent review" disabled={busy||loading}
        onClick={()=>{setLoading(true);void refresh().catch(e=>setError(e instanceof Error?e.message:"Review unavailable")).finally(()=>setLoading(false));}}>
        <RefreshCw size={16}/> Refresh
      </button>
    </header>
    <div className={styles.steps} aria-label="Laptop approval workflow">
      <span><ClipboardCheck size={15}/> 1 · Security review</span>
      <span><ShieldCheck size={15}/> 2 · Independent approval</span>
      <span><Laptop size={15}/> 3 · Bind actual laptop</span>
    </div>
    {error?<p role="alert" className={styles.error}><CircleAlert size={16}/>{error}</p>:null}
    {notice?<p role="status" className={styles.notice}><CheckCircle2 size={16}/>{notice}</p>:null}
    {loading?<p role="status" className={styles.hint}>Loading company device review status…</p>:null}
    {!loading&&!devices.length?<p className={styles.hint}>No Founder computers are registered in your current scope.</p>:null}
    {devices.map(device=>{
      const revoked=device.trust_state==="REVOKED", trusted=device.trust_state==="TRUSTED";
      const review=device.review;
      return <article className={styles.device} key={device.id}>
        <div className={styles.deviceHead}>
          <div><strong>{device.device_label}</strong>
            <p>{device.platform||"Platform not verified"} · {device.device_kind}</p>
          </div>
          <span className={styles.badge} data-state={device.trust_state}>{device.trust_state}</span>
        </div>
        {revoked?<p className={styles.hold}><LockKeyhole size={16}/> Security hold: this device remains revoked until an independent review and approval.</p>:null}
        <div className={styles.details}>
          <div><small>Latest posture</small><strong>{device.latest_posture?.status??"Not reviewed"}</strong></div>
          <div><small>Compromise flag</small><strong>{device.latest_posture?.compromise?"Reported · verify":"No active report"}</strong></div>
          <div><small>Review</small><strong>{review?.status??"Not submitted"}</strong></div>
          <div><small>Last review</small><strong>{when(review?.reviewed_at)}</strong></div>
        </div>
        {device.latest_posture?.status==="COMPLIANT"&&device.latest_posture.compromise?
          <p className={styles.hold}>The previous record combined COMPLIANT with a compromise flag. A new independently verified assessment is required.</p>:null}
        {review?.status==="PENDING"?<p className={styles.next}>Security review recorded. The reviewer cannot approve the same review; a second authorised person must sign off.</p>:null}
        {trusted?<p className={styles.next}>Approval recorded. The Founder should use the **Bind this browser** action above on the verified Windows laptop.</p>:null}
        <div className={styles.actions}>
          {device.reviewer_can_attest?<button type="button" disabled={busy} onClick={()=>beginReview(device)}>
            <ClipboardCheck size={16}/> Review security
          </button>:null}
          {device.approver_can_sign?<button type="button" disabled={busy} onClick={()=>beginApproval(device)}>
            <ShieldCheck size={16}/> Approve reviewed device
          </button>:null}
          {!device.reviewer_can_attest&&!device.approver_can_sign&&!trusted?
            <span className={styles.hint}>Waiting for a separate Director and Administrator to complete verification.</span>:null}
        </div>
      </article>;
    })}
    {action&&current?<div className={styles.backdrop} role="presentation" onMouseDown={()=>{if(!busy)setAction(null);}}>
      <form className={styles.dialog} role="dialog" aria-modal="true"
        aria-label={action==="REVIEW"?"Verify laptop security":"Approve independently reviewed laptop"}
        onMouseDown={event=>event.stopPropagation()} onSubmit={event=>{event.preventDefault();void submit();}}>
        <header><div><small>{action==="REVIEW"?"STEP 1 · INDEPENDENT VERIFICATION":"STEP 2 · SECOND-PERSON APPROVAL"}</small>
            <h3>{action==="REVIEW"?"Verify actual laptop":"Approve reviewed laptop"}</h3></div>
          <button type="button" disabled={busy} aria-label="Close security review" onClick={()=>setAction(null)}>✕</button>
        </header>
        <p className={styles.hint}>{current.device_label}. Neither the device owner nor a single person can complete both decisions.</p>
        {action==="REVIEW"?<>
          <label>Verified operating system
            <input required minLength={3} maxLength={120} value={form.os_version} placeholder="Windows 11, version 24H2"
              onChange={event=>setForm(prev=>({...prev,os_version:event.target.value}))}/>
          </label>
          <fieldset className={styles.checks}><legend>Confirm each check only after inspecting the real laptop</legend>
            {checks.map(([key,label])=><label key={key}>
              <input type="checkbox" checked={form[key]}
                onChange={event=>setForm(prev=>({...prev,[key]:event.target.checked}))}/>
              {label}
            </label>)}
          </fieldset>
          <label>Corporate asset / management evidence reference
            <input required minLength={12} maxLength={300} value={form.management_evidence}
              placeholder="Asset register ID or approved management record"
              onChange={event=>setForm(prev=>({...prev,management_evidence:event.target.value}))}/>
          </label>
          <label>Verification notes (30–500 characters)
            <textarea required minLength={30} maxLength={500} rows={4} value={form.notes}
              placeholder="Record how Defender scan, encryption, updates and management were verified"
              onChange={event=>setForm(prev=>({...prev,notes:event.target.value}))}/>
          </label>
          <p className={styles.hold}>Checking these boxes records a human attestation, not an automatic device scan. Do not approve a personal/BYOD device as company-managed without a formal management record.</p>
        </>:<>
          <p className={styles.hint}>Review completed {when(current.review?.reviewed_at)}. You must be a different person from the reviewer and device owner.</p>
          <label>Approval reason (20–500 characters)
            <textarea required minLength={20} maxLength={500} rows={4} value={reason}
              placeholder="Confirm the independent inspection evidence and authorisation"
              onChange={event=>setReason(event.target.value)}/>
          </label>
        </>}
        <footer><button type="button" disabled={busy} onClick={()=>setAction(null)}>Cancel</button>
          <button className={styles.primary} type="submit" disabled={busy||(action==="REVIEW"?!approvedReady:reason.trim().length<20)}>
            {busy?"Saving…":action==="REVIEW"?"Submit independent review":"Approve and release device"}
          </button>
        </footer>
      </form>
    </div>:null}
  </section>;
}
