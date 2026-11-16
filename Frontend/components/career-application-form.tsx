"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight,FileCheck2,ShieldCheck } from "lucide-react";
import styles from "./careers-public.module.css";

export function CareerApplicationForm({jobSlug,jobTitle}:{jobSlug:string;jobTitle:string}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(false);
  const [resume,setResume]=useState<File|null>(null);
  const [reference,setReference]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");
    const form=new FormData(event.currentTarget);
    form.set("job_slug",jobSlug);
    if(resume)form.set("resume",resume,resume.name);
    try{
      const response=await fetch("/api/careers/apply",{method:"POST",credentials:"same-origin",body:form,cache:"no-store"});
      const body=await response.json().catch(()=>({detail:"Unable to submit application"}));
      if(!response.ok)throw new Error(body.detail||"Application submission unavailable");
      if(typeof body.reference==="string")setReference(body.reference);
      setSuccess(true);
    }catch(e){setError(e instanceof Error?e.message:"Application submission failed");}
    finally{setBusy(false);}
  }
  if(success)return <div className={styles.state} role="status">
    <FileCheck2 color="#546db4" size={30}/>
    <h2>Verification requested</h2>{reference?<p><strong>Application reference:</strong> {reference} — save this code to request a replacement access link.</p>:null}
    <p>If your application was accepted for processing, you will receive a secure email verification link. Confirm your address before HR can import your application. An email-provider acceptance is not proof of inbox delivery.</p>
    <div className={styles.actions}><Link className={styles.buttonAlt} href="/careers/application">Application access</Link>
      <Link className={styles.buttonAlt} href="/careers">Browse vacancies</Link></div>
  </div>;
  return <form className={styles.form} onSubmit={submit}>
    <div><p className={styles.kicker}>PRIVATE APPLICATION · {jobSlug}</p><h2>Apply for {jobTitle}</h2>
      <p className={styles.explain}>Only employment-relevant details are collected. Bank, Aadhaar and tax information are not requested at this stage.</p></div>
    <label>Full legal name <input name="full_name" required minLength={2} maxLength={220} autoComplete="name" placeholder="Full name"/></label>
    <label>Email address <input name="email" type="email" required autoComplete="email" maxLength={320} placeholder="name@example.com"/></label>
    <label>Phone (optional) <input name="phone" type="tel" autoComplete="tel" maxLength={32} placeholder="+91 ..."/></label>
    <label>Current city or region (optional) <input name="location" autoComplete="address-level2" maxLength={250} placeholder="City, state"/></label>
    <label>Relevant experience or message (optional)
      <textarea name="note" maxLength={2500} rows={4} placeholder="A concise description of your relevant skills and interests"/>
    </label>
    <label>Resume — PDF, up to 4 MB (optional)
      <input type="file" accept=".pdf,application/pdf" onChange={e=>{
        const file=e.currentTarget.files?.[0]||null;
        if(file && file.size>4_194_304){setError("Resume must be less than 4 MB");setResume(null);e.currentTarget.value="";return;}
        setError("");setResume(file);
      }}/>
      <small>Files remain private and quarantined until HR performs a successful malware scan. Do not upload identity documents here.</small>
    </label>
    <label className={styles.check}>
      <input type="checkbox" required name="privacy" value="yes"/>
      <span>I have read the <Link className={styles.back} href="/trust/privacy" target="_blank">Privacy Notice</Link> and agree to the processing of my application for recruitment and verification.</span>
    </label>
    <label className={styles.check}>
      <input type="checkbox" name="communication" value="yes" defaultChecked/>
      <span>Send me application-related progress and interview notices. I understand that essential verification and security notices are part of applying.</span>
    </label>
    <div aria-hidden="true" style={{position:"absolute",left:"-9999px",width:1,height:1,overflow:"hidden"}}>
      <label>Website<input name="website" type="text" autoComplete="off" tabIndex={-1}/></label>
    </div>
    {error?<p className={styles.error} role="alert">{error}</p>:null}
    <button className={styles.button} type="submit" disabled={busy||!!error}><ShieldCheck size={15}/>{busy?"Submitting securely…":"Submit application"} <ArrowRight size={15}/></button>
    <p className={styles.minor}>HR reviews submissions against the approved requisition. An application does not constitute a job offer or guarantee selection. Candidates are not enrolled in KRAVIA Office until the governed onboarding process is complete.</p>
  </form>;
}
