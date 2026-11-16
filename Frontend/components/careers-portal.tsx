"use client";
import Link from "next/link";
import { useCallback,useEffect,useState } from "react";
import { ArrowRight,CalendarClock,FileCheck2,LockKeyhole,LogOut,Mail,RefreshCw,ShieldCheck } from "lucide-react";
import styles from "./careers-public.module.css";
type Interview={id:string;title:string;scheduled_start:string;scheduled_end:string|null;location_or_link:string|null;status:string};
type Offer={id:string;offer_code:string;joining_date:string;monthly_gross_minor:number;currency:string;status:string;valid_until:string|null};
type Action={id:string;interview_id:string|null;offer_id:string|null;action_type:string;status:string;created_at:string};
type Portal={
  reference:string;name:string;email:string;status:string;stage:string;candidate_reference:string|null;
  role:string;department:string;interviews:Interview[];offer:Offer|null;requested_documents:Array<{id:string;label:string;status:string;required:boolean;upload_status:string|null}>;
  actions:Action[];notice:string;
};
function nice(v:string){return v.replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());}
export function CareersPortal() {
  const [portal,setPortal]=useState<Portal|null>(null),[loading,setLoading]=useState(true);
  const [locked,setLocked]=useState(false),[busy,setBusy]=useState(false);
  const [message,setMessage]=useState(""),[error,setError]=useState("");
  const [name,setName]=useState(""),[note,setNote]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const res=await fetch("/api/careers/portal",{cache:"no-store",credentials:"same-origin"});
      if(res.status===401){setLocked(true);setPortal(null);return;}
      const body=await res.json().catch(()=>null);
      if(!res.ok)throw new Error(body?.detail||"Candidate status is not available");
      setLocked(false);setPortal(body as Portal);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load private application");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  async function uploadDocument(requestId:string,file:File) {
    if(busy)return;
    setBusy(true);setMessage("");setError("");
    try {
      if(file.size>4_194_304)throw new Error("Document exceeds the 4 MB limit");
      const form=new FormData();form.set("request_id",requestId);form.set("document",file,file.name);
      const response=await fetch("/api/careers/documents",{
        method:"POST",credentials:"same-origin",body:form,cache:"no-store"
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(result?.detail||"Document was not securely received");
      setMessage("Document stored in private quarantine. HR will scan and review it; no automatic acceptance is implied.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Secure upload unavailable");}
    finally{setBusy(false);}
  }
  async function requestLink(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError("");setMessage("");
    const f=new FormData(e.currentTarget);
    try {
      const res=await fetch("/api/careers/access",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({email:f.get("email"),reference:f.get("reference")}),cache:"no-store",
      });
      const json=await res.json().catch(()=>null);
      if(!res.ok)throw new Error(json?.detail||"Unable to request access");
      setMessage("If your verified application is eligible, a one-time access link has been requested. Check your inbox.");
    }catch(err){setError(err instanceof Error?err.message:"Secure access is unavailable");}
    finally{setBusy(false);}
  }
  async function action(payload:Record<string,unknown>,ask?:string) {
    if(ask&&!window.confirm(ask))return;
    setBusy(true);setError("");setMessage("");
    try{
      const res=await fetch("/api/careers/portal",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify(payload),cache:"no-store",
      });
      const json=await res.json().catch(()=>null);
      if(!res.ok)throw new Error(json?.detail||"Unable to record your request");
      if(payload.action==="SIGN_OUT"){setLocked(true);setPortal(null);}
      else {setMessage(json.message||"Your response was recorded");await load();}
    }catch(err){setError(err instanceof Error?err.message:"Unable to submit action");}
    finally{setBusy(false);}
  }
  if(loading&&!portal&&!locked)return <div className={styles.shell+" shell"}><div className={styles.state}>Loading your private application…</div></div>;
  if(locked)return <section className={styles.shell+" shell"} style={{maxWidth:820,margin:"auto",minHeight:"60vh"}}>
    <p className={styles.kicker}><LockKeyhole size={14}/> PRIVATE CANDIDATE ACCESS</p>
    <h1 className={styles.heading}>Access your KRAVIA application</h1>
    <p className={styles.lead}>Enter the email and reference from your original application. We send a short-lived, single-use access link. No employee account is required.</p>
    <form className={styles.form} onSubmit={requestLink}>
      <label>Email address<input name="email" type="email" required maxLength={320} autoComplete="email"/></label>
      <label>Application reference<input name="reference" required minLength={6} maxLength={40} placeholder="KR-APP-..." autoComplete="off"/></label>
      {error?<p className={styles.error} role="alert">{error}</p>:null}
      {message?<p className={styles.notice} role="status">{message}</p>:null}
      <button type="submit" className={styles.button} disabled={busy}><Mail size={15}/>{busy?"Requesting…":"Send access link"}</button>
    </form>
    <p className={styles.minor}>If you never verified your first application email, return to the verification message. For identity-sensitive corrections use the privacy request process.</p>
  </section>;
  return <section className={styles.shell+" shell"} style={{minHeight:"60vh"}}>
    <div className={styles.topline}><div><p className={styles.kicker}>PRIVATE CANDIDATE WORKSPACE</p><h1 className={styles.heading}>Application progress</h1></div>
      <div className={styles.actions}>
        <button className={styles.buttonAlt} type="button" disabled={busy} onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button>
        <button className={styles.buttonAlt} type="button" disabled={busy} onClick={()=>void action({action:"SIGN_OUT"})}><LogOut size={15}/> Sign out</button>
      </div></div>
    {error?<p className={styles.error} role="alert">{error}</p>:null}
    {message?<p className={styles.notice} role="status">{message}</p>:null}
    {!portal? <div className={styles.state}><h2>Status unavailable</h2><p>Try refreshing. No unverified application data will be shown.</p></div>:<>
      <div className={styles.grid}>
        <article className={styles.card}>
          <p className={styles.kicker}>APPLICATION</p><h2>{portal.role}</h2>
          <p>{portal.name} · {portal.email}</p>
          <p>Reference: <strong>{portal.reference}</strong></p>
          <p>Status: <span className={styles.pill}>{nice(portal.stage)}</span></p>
          <p className={styles.minor}>Verified applicant: {nice(portal.status)} · {portal.candidate_reference||"Awaiting HR intake"}</p>
        </article>
        <article className={styles.card}>
          <p className={styles.kicker}>SECURE COMMUNICATION</p><h2>How we contact you</h2>
          <p>Important changes are communicated through the authorized KRAVIA recruitment channel. Interview details below are visible only after you sign in through your verified email.</p>
          <p className={styles.minor}>{portal.notice}</p>
        </article>
      </div>
      <div className={styles.stack} style={{marginTop:20}}>
        <h2 style={{fontSize:19,margin:0}}>Interviews and appointments</h2>
        {portal.interviews.length?portal.interviews.map(i=><article key={i.id} className={styles.task}>
          <h3><CalendarClock size={15}/> {i.title}</h3>
          <p>{new Date(i.scheduled_start).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"})} IST · {nice(i.status)}</p>
          <p>{i.location_or_link||"Location or meeting link will be shared by HR"}</p>
          {i.status==="SCHEDULED"?<div className={styles.actions}>
            <button className={styles.buttonAlt} disabled={busy} type="button"
              onClick={()=>void action({action:"INTERVIEW_CONFIRMATION",interview_id:i.id})}>
              <ShieldCheck size={14}/> Confirm attendance
            </button>
            <button className={styles.buttonAlt} disabled={busy} type="button" onClick={()=>{
              const reason=window.prompt("Reason and requested time windows (12 characters minimum):",note);
              if(reason&&reason.trim().length>=12){setNote(reason);void action({action:"RESCHEDULE_REQUEST",interview_id:i.id,note:reason});}
            }}>Request reschedule</button>
          </div>:null}
        </article>):<div className={styles.state}><p>No interview appointments are scheduled at present.</p></div>}
        <h2 style={{fontSize:19,margin:"8px 0 0"}}>Offer and onboarding</h2>
        {portal.offer?<div className={styles.task}>
          <p className={styles.kicker}><FileCheck2 size={15}/> OFFICIAL DELIVERED OFFER</p>
          <h3>{portal.offer.offer_code}</h3>
          <p>Status: {nice(portal.offer.status)} · Proposed start date: {portal.offer.joining_date}</p>
          <p>Monthly gross stated in issued offer: {new Intl.NumberFormat("en-IN",{style:"currency",currency:portal.offer.currency}).format(portal.offer.monthly_gross_minor/100)}</p>
          <p className={styles.minor}>Review the official signed document delivered by HR. This portal acknowledgement does not constitute a provider-verified legal signature or automatic appointment.</p>
          {portal.offer.status==="OFFERED"?<>
            <label className={styles.form} style={{padding:10,display:"grid",gap:6}}>
              Type your full application name to acknowledge the offer
              <input value={name} onChange={e=>setName(e.target.value)} maxLength={220} autoComplete="name"/>
            </label>
            <button type="button" className={styles.button} disabled={busy} onClick={()=>void action({
              action:"OFFER_ACKNOWLEDGED",offer_id:portal.offer?.id,typed_name:name
            },"This records your offer acknowledgement for independent HR verification. Continue?")}>
              <ShieldCheck size={15}/> Record offer response <ArrowRight size={15}/>
            </button>
          </>:null}
        </div>:<div className={styles.state}><p>No officially delivered offer is available in your candidate portal. Unapproved proposals and internal HR notes are private.</p></div>}
        <h2 style={{fontSize:19,margin:"8px 0 0"}}>Document requests</h2>
        {portal.requested_documents.length?portal.requested_documents.map(d=><div key={d.id} className={styles.task}>
          <h3>{d.label}</h3><p>{nice(d.status)} · {d.required?"Required":"Optional"}</p>
          <p className={styles.minor}>Upload status: {d.upload_status?nice(d.upload_status):"Not submitted"}. Documents remain private and quarantined until scanned by authorized HR.</p>
          {["REQUESTED","REJECTED"].includes(d.status)&&(!d.upload_status||d.upload_status==="REJECTED")?
            <label className={styles.form} style={{padding:11}}>
              Upload requested document (PDF/JPEG/PNG, maximum 4 MB)
              <input aria-label={"Upload "+d.label} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                disabled={busy} onChange={e=>{
                  const f=e.currentTarget.files?.[0];if(f)void uploadDocument(d.id,f);
                }}/>
            </label>:null}
          <p className={styles.minor}>Only supply what HR expressly requested. Identity and banking documents must be handled through the approved private onboarding system, not by email.</p>
        </div>):<div className={styles.state}><p>There are no pending candidate document requests.</p></div>}
        <h2 style={{fontSize:19,margin:"8px 0 0"}}>Your requests</h2>
        {portal.actions.length?<div className={styles.grid}>{portal.actions.map(a=><div key={a.id} className={styles.task}>
          <h3>{nice(a.action_type)}</h3><p>{nice(a.status)} · {new Date(a.created_at).toLocaleString("en-IN")}</p>
        </div>)}</div>:<p className={styles.minor}>Candidate confirmations and requests will appear here when submitted.</p>}
        {portal.status!=="WITHDRAWN"&&portal.status!=="ARCHIVED"?<button className={styles.buttonAlt} type="button" disabled={busy}
          onClick={()=>void action({action:"WITHDRAWAL"},"Withdraw this application? HR will retain required audit evidence and close the internal case.")}>
          Withdraw this application
        </button>:null}
      </div>
    </>}
    <p className={styles.minor} style={{marginTop:25}}>Need personal-data correction or deletion? Use the <Link className={styles.back} href="/privacy-request">secure privacy request</Link> process. This portal never displays unrelated employee records.</p>
  </section>;
}
