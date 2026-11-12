"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, MailCheck, RefreshCw, ShieldCheck } from "lucide-react";
import styles from "./office-employee-mail-controls.module.css";

type DeliveryPolicy = {
  kind: "EMPLOYEE_ID_ISSUED";
  enabled: boolean;
  approved_at: string | null;
  effective_from: string | null;
  note: string;
};

async function read<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-employee-mail-policy", {
    ...init,
    credentials:"same-origin",
    cache:"no-store",
  });
  const body = await response.json().catch(() => ({}));
  if(!response.ok)throw new Error(
    typeof body.detail === "string" ? body.detail : "Private corporate mail control unavailable",
  );
  return body as T;
}

/** Explicit Owner-only, AAL2, effective-dated corporate mail control.
 * This component never triggers an email or bypasses the worker approval RPC.
 */
export function OfficeEmployeeMailControls() {
  const [policy,setPolicy]=useState<DeliveryPolicy>();
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [reason,setReason]=useState("");
  const [acknowledged,setAcknowledged]=useState(false);
  const [busy,setBusy]=useState(false);

  const refresh=useCallback(async(signal?:AbortSignal)=>{
    const next=await read<DeliveryPolicy>({signal});
    if(!signal?.aborted)setPolicy(next);
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    void refresh(controller.signal).catch(cause=>{
      if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Delivery policy unavailable");
    });
    return()=>controller.abort();
  },[refresh]);

  async function updatePolicy() {
    if(!policy || reason.trim().length<12 || busy || (!policy.enabled&&!acknowledged))return;
    const nextEnabled=!policy.enabled;
    setBusy(true);setError("");setNotice("");
    try {
      const next=await read<DeliveryPolicy>({
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({enabled:nextEnabled,reason:reason.trim()}),
      });
      setPolicy(next);
      setReason("");
      setAcknowledged(false);
      setNotice(next.enabled
        ? "Policy activation was recorded. Only newly eligible, verified employee ID notifications can be claimed by a separately configured worker."
        : "Employee-ID email event delivery was disabled. Existing sent or unknown outcomes remain in their audit records.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Policy mutation was not confirmed");}
    finally{setBusy(false);}
  }

  return <section className={styles.shell} aria-label="Corporate employee ID mail delivery controls">
    <div className={styles.heading}>
      <MailCheck aria-hidden="true" size={22}/>
      <div><h3>Employee ID communications</h3>
      <p>Restricted corporate notification policy · Owner approval only</p></div>
      <button type="button" className={styles.refresh} disabled={busy}
        onClick={()=>{setError("");void refresh().catch(cause=>setError(cause instanceof Error?cause.message:"Policy unavailable"));}}
        aria-label="Refresh corporate email policy"><RefreshCw size={17}/></button>
    </div>
    {error?<p role="alert" className={styles.error}><AlertTriangle size={16}/>{error}</p>:null}
    {notice?<p role="status" className={styles.notice}><ShieldCheck size={16}/>{notice}</p>:null}
    {!policy ? <p className={styles.state}>Mail delivery policy unavailable or loading. No activation is inferred.</p> : <>
      <dl className={styles.info}>
        <div><dt>Event</dt><dd>Verified permanent employee ID issued</dd></div>
        <div><dt>Database dispatch policy</dt><dd>{policy.enabled?"Approved for new eligible events":"Disabled"}</dd></div>
        <div><dt>Approval recorded</dt><dd>{policy.approved_at?new Date(policy.approved_at).toLocaleString("en-IN"):"Not recorded"}</dd></div>
        <div><dt>Effective from</dt><dd>{policy.effective_from?new Date(policy.effective_from).toLocaleString("en-IN"):"Not activated"}</dd></div>
      </dl>
      <p className={styles.state}>{policy.note}</p>
      <label className={styles.label} htmlFor="office-employee-mail-reason">
        Documented reason and authorisation reference
      </label>
      <textarea id="office-employee-mail-reason" rows={3} minLength={12} maxLength={500}
        value={reason} onChange={event=>setReason(event.target.value)}
        placeholder="Record the corporate approval or emergency suspension reason"/>
      {!policy.enabled ? <label className={styles.confirm}>
        <input type="checkbox" checked={acknowledged}
          onChange={event=>setAcknowledged(event.target.checked)}/>
        <span>I have verified the Brevo worker configuration and the eligible event criteria. Activation does not send prior or historical notices.</span>
      </label>:null}
      <button type="button" className={styles.action}
        disabled={busy || reason.trim().length<12 || (!policy.enabled&&!acknowledged)}
        onClick={()=>void updatePolicy()}>
        {busy ? "Recording approved policy…" : policy.enabled
          ? "Disable new employee ID notices" : "Approve new employee ID notices"}
      </button>
      <p className={styles.state}>
        Provider acceptance is not proof of mailbox delivery. Unknown outcomes require reconciliation; this screen cannot replay or send messages directly.
      </p>
    </>}
  </section>;
}
