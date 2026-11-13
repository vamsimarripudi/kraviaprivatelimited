"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ClipboardCheck, LockKeyhole, RefreshCw } from "lucide-react";
import styles from "./office-lifecycle-mail-controls.module.css";

type Policy={
  event_code:string;priority:"P0"|"P1"|"P2";
  source_ready:boolean;enabled:boolean;delivery_owner:"LIFECYCLE_WORKER"|"FIRST_PARTY_AUTH"|"CANDIDATE_WORKER"|"EXTERNAL_NOTICE_WORKER";
  intent:string;subject:string;trigger_description:string;recipient_description:string;
  approved_at:string|null;effective_from:string|null;
};
type Data={
  policies:Policy[];total:number;source_ready:number;enabled:number;
  count_by_status?:Record<string,number|null>;
  counts_by_source?:Record<string,Record<string,number|null>>;
  notice:string;
};
const categories=["AUTH","HIRE","ONB","ROLE","TIME","PAY","DEV","EXIT"] as const;
async function request(init?:RequestInit):Promise<Data>{
  const response=await fetch("/api/office-lifecycle-mail-policy",{
    ...init,credentials:"same-origin",cache:"no-store",
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(
    typeof body.detail==="string"?body.detail:"Corporate lifecycle registry unavailable",
  );
  return body as Data;
}

export function OfficeLifecycleMailControls(){
  const [data,setData]=useState<Data>();
  const [category,setCategory]=useState<string>("ONB");
  const [selected,setSelected]=useState("ONB-05");
  const [reason,setReason]=useState("");
  const [approved,setApproved]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const refresh=useCallback(async(signal?:AbortSignal)=>{
    const next=await request({signal});
    if(!signal?.aborted)setData(next);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    void refresh(controller.signal).catch(cause=>{
      if(!controller.signal.aborted)
        setError(cause instanceof Error?cause.message:"Lifecycle mail policy unavailable");
    });
    return()=>controller.abort();
  },[refresh]);

  const matching=data?.policies.filter(row=>row.event_code.startsWith(category+"-"))||[];
  const active=data?.policies.find(row=>row.event_code===selected);
  const canToggle=Boolean(active&&
    active.delivery_owner!=="FIRST_PARTY_AUTH" &&
    (active.enabled || (active.source_ready&&approved)) && reason.trim().length>=12 && !busy);

  async function update(){
    if(!active||!canToggle)return;
    setBusy(true);setError("");setNotice("");
    try{
      const next=await request({
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({event_code:active.event_code,enabled:!active.enabled,reason:reason.trim()}),
      });
      setData(next);setReason("");setApproved(false);
      setNotice(active.enabled
        ? "A governed suspension was recorded; historical provider outcomes remain unchanged."
        : "Owner approval recorded. Only new, verified source events can enter the outbox; the worker still requires independent configuration.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Approval was not recorded");}
    finally{setBusy(false);}
  }

  return <section className={styles.shell} aria-label="81-event lifecycle mail governance">
    <header className={styles.head}>
      <ClipboardCheck size={22} aria-hidden="true"/>
      <div><h3>Lifecycle notification governance</h3>
        <p>81 canonical event codes · private delivery and source checks</p></div>
      <button type="button" aria-label="Refresh lifecycle delivery policies"
        disabled={busy} onClick={()=>{setError("");void refresh().catch(cause=>setError(cause instanceof Error?cause.message:"Lifecycle registry unavailable"));}}>
        <RefreshCw size={16}/>
      </button>
    </header>
    {error?<p className={styles.error} role="alert"><AlertTriangle size={16}/>{error}</p>:null}
    {notice?<p className={styles.notice} role="status">{notice}</p>:null}
    {data?<><div className={styles.metrics}>
      <div><small>Catalog</small><strong>{data.total} events</strong></div>
      <div><small>Covered event sources</small><strong>{data.source_ready} / {data.total}</strong></div>
      <div><small>Owner-enabled routes</small><strong>{data.enabled}</strong></div>
    </div>
    <p className={styles.explanation}>{data.notice}</p>
    <div className={styles.categories} role="group" aria-label="Lifecycle event category">
      {categories.map(prefix=><button type="button" key={prefix}
        data-active={category===prefix} onClick={()=>{setCategory(prefix);setSelected(
          data.policies.find(p=>p.event_code.startsWith(prefix+"-"))?.event_code||""
        );setError("");setNotice("");setApproved(false);}}>
        {prefix}
      </button>)}
    </div>
    <label htmlFor="office-lifecycle-event" className={styles.label}>Notification event</label>
    <select id="office-lifecycle-event" value={selected}
      onChange={event=>{setSelected(event.target.value);setApproved(false);setError("");setNotice("");}}>
      {matching.map(p=><option key={p.event_code} value={p.event_code}>
        {p.event_code} · {p.delivery_owner==="FIRST_PARTY_AUTH"?"Existing secure mail":p.source_ready?"Source verified, dispatch gated":"Source not implemented"}
      </option>)}
    </select>
    {active?<div className={styles.summary}>
      <strong>{active.intent}</strong>
      <p>Subject: {active.subject}</p>
      <small>Committed event requirement: {active.trigger_description}</small>
      <small>Authorised recipient: {active.recipient_description}</small>
    </div>:null}
    {active?<div className={styles.details}>
      <div><span>Priority</span><strong>{active.priority}</strong></div>
      <div><span>Committed source adapter</span>
        <strong>{active.delivery_owner==="FIRST_PARTY_AUTH"?"Handled by first-party authentication":active.delivery_owner==="CANDIDATE_WORKER"?"Consent-verified candidate mail worker":active.delivery_owner==="EXTERNAL_NOTICE_WORKER"?"Signing / former-staff proof + consent":active.source_ready?"Verified source pathway":"Not yet implemented"}</strong></div>
      <div><span>Delivery owner</span><strong>{active.delivery_owner==="FIRST_PARTY_AUTH"?"Existing authenticated email sender":active.delivery_owner==="CANDIDATE_WORKER"?"Consent-verified candidate worker":active.delivery_owner==="EXTERNAL_NOTICE_WORKER"?"Separately gated external notice worker":"Governed lifecycle worker"}</strong></div>
       <div><span>Owner dispatch policy</span><strong>{active.enabled?"Enabled":"Disabled"}</strong></div>
      <div><span>Last approval</span><strong>{active.approved_at?
        new Date(active.approved_at).toLocaleString("en-IN"):"None"}</strong></div>
      <div><span>Effective from</span><strong>{active.effective_from?
        new Date(active.effective_from).toLocaleString("en-IN"):"Not activated"}</strong></div>
    </div>:null}
    {active?.delivery_owner==="FIRST_PARTY_AUTH"?
      <p className={styles.blocked}><LockKeyhole size={17}/>
        This security email already uses the authenticated KRAVIA Office transactional sender.
        Lifecycle delivery cannot be enabled for it, preventing duplicate codes, invitations, device links or password resets.
      </p>:null}
    {active&&!active.source_ready?
      <p className={styles.blocked}><LockKeyhole size={17}/>
        This event is intentionally blocked. Its real, independently verifiable source and recipient
        must be integrated before the Owner can approve delivery.
      </p>:null}
    {active?.delivery_owner==="EXTERNAL_NOTICE_WORKER"?<p className={styles.blocked}>
      <LockKeyhole size={17}/>
      External notices require valid independent consent or an issued provider signing request.
      Enabling this policy does not enable its separately configured delivery worker.
      No former employee will receive a message at a revoked corporate mailbox.
    </p>:null}
    <div className={styles.counts} role="group" aria-label="Private provider outbox outcomes">
      {["PENDING","SENDING","SENT","REJECTED","UNKNOWN"].map(status=>
        <div key={status}><small>{status==="SENT"?"Provider accepted":status.toLowerCase()}</small>
          <strong>{typeof (data.counts_by_source?.[
            active?.delivery_owner==="CANDIDATE_WORKER"?"candidate":
            active?.delivery_owner==="EXTERNAL_NOTICE_WORKER"?"external":"internal"
          ]?.[status]??data.count_by_status?.[status])==="number"?
            Number(data.counts_by_source?.[
              active?.delivery_owner==="CANDIDATE_WORKER"?"candidate":
              active?.delivery_owner==="EXTERNAL_NOTICE_WORKER"?"external":"internal"
            ]?.[status]??data.count_by_status?.[status]).toLocaleString("en-IN"):"Unknown"}</strong>
        </div>)}
    </div>
    <label className={styles.label} htmlFor="office-lifecycle-reason">Corporate approval or suspension reference</label>
    <textarea id="office-lifecycle-reason" maxLength={500} rows={3} value={reason}
      placeholder="Record the independent review and the reason for this specific event"
      onChange={event=>setReason(event.target.value)}/>
    {active&&!active.enabled&&active.source_ready&&active.delivery_owner!=="FIRST_PARTY_AUTH"?<label className={styles.confirm}>
      <input type="checkbox" checked={approved} onChange={event=>setApproved(event.target.checked)}/>
      I verified this event recipient, source data, and Brevo worker configuration.
      No earlier or unverified event will be resent.
    </label>:null}
    <button type="button" className={styles.primary} disabled={!canToggle}
      onClick={()=>void update()}>
      {busy?"Recording documented decision…" : active?.enabled
        ? "Suspend this lifecycle notification" : "Approve only this verified event"}
    </button>
    <p className={styles.explanation}>This dashboard records policy decisions only. Counts above belong to the selected route's delivery worker; they do not represent inbox receipts.
      It does not provide a manual send function and does not confer any payroll, signature or
      access rights.</p>
    </> : <p className={styles.explanation}>Lifecycle policy not loaded.
      No event activation or delivery can be assumed.</p>}
  </section>;
}
