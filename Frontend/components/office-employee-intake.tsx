"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, BookOpen, CheckCircle2, ChevronRight, CircleAlert, FileText, IdCard, ImagePlus, Save, ShieldCheck, Upload, UserRound, Wallet } from "lucide-react";
import styles from "./office-employee-intake.module.css";

type Education={qualification:string;institution:string;year?:number;course?:string};
type Address={street?:string;city?:string;state?:string;postal_code?:string;country?:string};
type Profile={
  legal_name?:string|null;preferred_name?:string|null;contact_phone?:string|null;date_of_birth?:string|null;
  current_address?:Address;education?:Education[];
  certificates?:Array<{label?:string;storage_reference?:string;review_status?:string}>;
  bank_account_last4?:string|null;bank_ifsc?:string|null;bank_account_holder?:string|null;bank_verified_at?:string|null;
  photo_storage_reference?:string|null;signature_evidence_reference?:string|null;policy_acknowledged_at?:string|null;
  status:"DRAFT"|"SUBMITTED"|"RETURNED"|"VERIFIED";review_note?:string|null;
};
type Overview={
  employee_user_id:string;self:boolean;
  identity:{display_name?:string;job_title?:string;primary_department?:string;status:string};
  profile:Profile|null;permanent_employee_id:string|null;issued_at:string|null;
  employment:{employment_code:string;status:string;start_date?:string|null}|null;
  bank_encryption_available:boolean;note:string;
};
type Person={user_id:string;display_name:string;department:string};
type Draft={
  legal_name:string;preferred_name:string;contact_phone:string;date_of_birth:string;
  current_address:Address;education:Education[];bank_account:string;bank_account_holder:string;bank_ifsc:string;
  signature_evidence_reference:string;policy_acknowledged:boolean;
};
const initial:Draft={
  legal_name:"",preferred_name:"",contact_phone:"",date_of_birth:"",
  current_address:{street:"",city:"",state:"",postal_code:"",country:"India"},
  education:[{qualification:"",institution:"",course:""}],
  bank_account:"",bank_account_holder:"",bank_ifsc:"",signature_evidence_reference:"",policy_acknowledged:false,
};
async function api<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{...init,credentials:"same-origin",cache:"no-store"});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(typeof body.detail==="string"?body.detail:"Private HR request unavailable");
  return body as T;
}
function fromProfile(profile:Profile|null,identity:Overview["identity"]):Draft{
  return {
    legal_name:profile?.legal_name||identity.display_name||"",
    preferred_name:profile?.preferred_name||"",
    contact_phone:profile?.contact_phone||"",
    date_of_birth:profile?.date_of_birth||"",
    current_address:profile?.current_address||initial.current_address,
    education:profile?.education?.length?profile.education:initial.education,
    bank_account:"",
    bank_account_holder:profile?.bank_account_holder||"",
    bank_ifsc:profile?.bank_ifsc||"",
    signature_evidence_reference:profile?.signature_evidence_reference||"",
    policy_acknowledged:Boolean(profile?.policy_acknowledged_at),
  };
}

export function OfficeEmployeeIntake({view="self"}:{view?:"self"|"hr"}){
  const [directory,setDirectory]=useState<Person[]>([]);
  const [target,setTarget]=useState("");
  const [state,setState]=useState<Overview>();
  const [draft,setDraft]=useState<Draft>(initial);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [reason,setReason]=useState("");
  const [bankEvidence,setBankEvidence]=useState("");
  const [certificateLabel,setCertificateLabel]=useState("");
  const [certificateFile,setCertificateFile]=useState<File|null>(null);
  const [photoFile,setPhotoFile]=useState<File|null>(null);

  const reload=useCallback(async(id?:string)=>{
    const endpoint="/api/office-employee-intake"+(id?"?employee="+encodeURIComponent(id):"");
    const next=await api<Overview>(endpoint);
    setState(next);setDraft(fromProfile(next.profile,next.identity));
    return next;
  },[]);
  useEffect(()=>{
    let active=true;
    const frame=window.requestAnimationFrame(()=>{
      if(view==="hr"){
        void api<{employees:Person[]}>("/api/office-employee-intake?directory=1")
          .then(result=>{if(active)setDirectory(result.employees)})
          .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"HR directory unavailable");});
      }else{
        void reload().catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Private intake unavailable");});
      }
    });
    return()=>{active=false;window.cancelAnimationFrame(frame)};
  },[view,reload]);

  async function choose(id:string){
    setTarget(id);setError("");setNotice("");setState(undefined);
    if(!id)return;
    try{await reload(id);}catch(cause){setError(cause instanceof Error?cause.message:"Employee record unavailable");}
  }
  async function post(body:object,success:string,id?:string){
    setBusy(true);setError("");setNotice("");
    try{
      await api("/api/office-employee-intake",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),
      });
      await reload(id||undefined);
      setNotice(success);
    }catch(cause){setError(cause instanceof Error?cause.message:"Onboarding action rejected");}
    finally{setBusy(false);}
  }
  function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    void post({action:"SAVE",...draft,date_of_birth:draft.date_of_birth||undefined,bank_account:draft.bank_account||undefined,education:draft.education.filter(e=>e.qualification||e.institution)},"Private employee draft saved.");
  }
  async function upload(kind:"PHOTO"|"CERTIFICATE"){
    const file=kind==="PHOTO"?photoFile:certificateFile;
    if(!file)return setError("Select the file first");
    setBusy(true);setError("");setNotice("");
    try{
      const data=new FormData();data.set("file",file);data.set("kind",kind);
      if(kind==="CERTIFICATE")data.set("label",certificateLabel);
      await api("/api/office-employee-intake/upload",{method:"POST",body:data});
      await reload();setNotice("File scanned and stored privately. Its approval is still pending.");
      setPhotoFile(null);setCertificateFile(null);setCertificateLabel("");
    }catch(cause){setError(cause instanceof Error?cause.message:"Secure document upload failed");}
    finally{setBusy(false);}
  }
  const editable=view==="self"&&(!state?.profile||state.profile.status==="DRAFT"||state.profile.status==="RETURNED");
  const reviewed=view==="hr"&&!state?.self;
  const profile=state?.profile;
  return <section className={styles.shell} aria-label={view==="hr"?"HR employee onboarding":"My employee onboarding"}>
    <header className={styles.heading}>
      <div><small>{view==="hr"?"HR · GOVERNED EMPLOYEE REVIEW":"MY VERIFIED EMPLOYEE RECORD"}</small>
        <h2>{view==="hr"?"Employee onboarding desk":"My onboarding & personal details"}</h2>
        <p>{view==="hr"?"Review submitted evidence, Finance verification and permanent IDs without reading raw bank details.":
          "Save a private draft, upload verified evidence, and submit it for independent HR review."}</p>
      </div>
      <IdCard size={24} aria-hidden="true"/>
    </header>
    {view==="hr"?<label className={styles.personPicker}>Employee
      <select value={target} onChange={event=>void choose(event.target.value)}>
        <option value="">Select an employee to review</option>
        {directory.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name} · {p.department}</option>)}
      </select></label>:null}
    {error?<p className={styles.error} role="alert"><CircleAlert size={16}/>{error}</p>:null}
    {notice?<p className={styles.notice} role="status"><CheckCircle2 size={16}/>{notice}</p>:null}
    {!state? <p className={styles.waiting}>{view==="hr"?"Select an employee to view the private review":"Loading your private onboarding record…"}</p>:
    <>
      <div className={styles.summary}>
        {profile?.photo_storage_reference?<Image unoptimized width={58} height={58}
          className={styles.photo} src={"/api/office-employee-intake/photo"+(!state.self?"?employee="+encodeURIComponent(state.employee_user_id):"")}
          alt={"Employee photo for "+(state.identity.display_name||"employee")}/>:
          <div className={styles.photoPlaceholder}><UserRound size={23}/></div>}
        <div><strong>{profile?.legal_name||state.identity.display_name||"Employee"}</strong>
          <small>{state.identity.primary_department||"Unassigned"} · {state.identity.job_title||"Role pending"}</small>
          <small>Employee reference: {state.permanent_employee_id||"Not yet issued"}</small>
          <small>Existing employment: {state.employment?.employment_code||"Not yet registered"}</small></div>
        <span className={styles.status} data-status={profile?.status||"DRAFT"}>{profile?.status||"NOT STARTED"}</span>
      </div>
      {profile?.review_note?<p className={styles.reviewNote}>Reviewer note: {profile.review_note}</p>:null}
      {view==="self"?<details className={styles.details} open={!profile}>
        <summary><BookOpen size={17}/> Employee intake details <ChevronRight size={16}/></summary>
        <form className={styles.form} onSubmit={save}>
          <fieldset disabled={!editable||busy}>
            <div className={styles.fields}>
              <label>Full legal name<input required minLength={2} maxLength={160} autoComplete="name"
                value={draft.legal_name} onChange={e=>setDraft(d=>({...d,legal_name:e.target.value}))}/></label>
              <label>Preferred name<input maxLength={120} value={draft.preferred_name}
                onChange={e=>setDraft(d=>({...d,preferred_name:e.target.value}))}/></label>
              <label>Phone<input required type="tel" autoComplete="tel" value={draft.contact_phone}
                onChange={e=>setDraft(d=>({...d,contact_phone:e.target.value}))}/></label>
              <label>Date of birth<input type="date" value={draft.date_of_birth}
                onChange={e=>setDraft(d=>({...d,date_of_birth:e.target.value}))}/></label>
              {(["street","city","state","postal_code","country"] as const).map(key=>
                <label key={key}>Address · {key.replaceAll("_"," ")}<input maxLength={250}
                  value={draft.current_address[key]||""}
                  onChange={e=>setDraft(d=>({...d,current_address:{...d.current_address,[key]:e.target.value}}))}/></label>)}
            </div>
            <div className={styles.subsection}><div className={styles.row}><strong>Education, qualifications and courses</strong>
              <button type="button" disabled={!editable||draft.education.length>=24} onClick={()=>setDraft(d=>({...d,education:[...d.education,{qualification:"",institution:"",course:""}]}))}>Add qualification</button></div>
              {draft.education.map((edu,i)=><div className={styles.edu} key={i}>
                <label>Qualification<input required value={edu.qualification} onChange={e=>setDraft(d=>({...d,education:d.education.map((x,j)=>j===i?{...x,qualification:e.target.value}:x)}))}/></label>
                <label>Institution<input required value={edu.institution} onChange={e=>setDraft(d=>({...d,education:d.education.map((x,j)=>j===i?{...x,institution:e.target.value}:x)}))}/></label>
                <label>Course<input value={edu.course||""} onChange={e=>setDraft(d=>({...d,education:d.education.map((x,j)=>j===i?{...x,course:e.target.value}:x)}))}/></label>
                <label>Completion year<input type="number" min={1950} max={2100} value={edu.year||""}
                  onChange={e=>setDraft(d=>({...d,education:d.education.map((x,j)=>j===i?{...x,year:e.target.value?Number(e.target.value):undefined}:x)}))}/></label>
                <button type="button" disabled={draft.education.length===1} onClick={()=>setDraft(d=>({...d,education:d.education.filter((_,j)=>j!==i)}))}>Remove</button>
              </div>)}
            </div>
            <div className={styles.subsection}>
              <strong>Bank details · encrypted server-side</strong>
              <small>Existing account: {profile?.bank_account_last4?"••••"+profile.bank_account_last4:"not recorded"}. Enter a new account only when updating it.</small>
              {!state.bank_encryption_available?<p className={styles.warn}>Bank encryption has not been configured by the Office administrator. Bank details cannot be saved yet.</p>:null}
              <div className={styles.fields}>
                <label>Bank account number<input type="password" inputMode="numeric" autoComplete="off"
                  value={draft.bank_account} onChange={e=>setDraft(d=>({...d,bank_account:e.target.value}))}
                  placeholder="Encrypted; never displayed again"/></label>
                <label>Account holder<input value={draft.bank_account_holder}
                  onChange={e=>setDraft(d=>({...d,bank_account_holder:e.target.value}))}/></label>
                <label>IFSC<input maxLength={11} value={draft.bank_ifsc}
                  onChange={e=>setDraft(d=>({...d,bank_ifsc:e.target.value.toUpperCase()}))}/></label>
              </div>
            </div>
            <div className={styles.subsection}>
              <strong>Signed appointment & policies</strong>
              <p>Enter the approved document instance reference. HR must independently verify the signed document; entering a reference does not count as a signature.</p>
              <label>Signed document evidence reference<input maxLength={450} value={draft.signature_evidence_reference}
                onChange={e=>setDraft(d=>({...d,signature_evidence_reference:e.target.value}))}/></label>
              <label className={styles.checkbox}><input type="checkbox" checked={draft.policy_acknowledged}
                onChange={e=>setDraft(d=>({...d,policy_acknowledged:e.target.checked}))}/>
                I acknowledge the applicable company policies and privacy notice.</label>
            </div>
            {editable?<button className={styles.primary} type="submit" disabled={busy}><Save size={16}/> Save private draft</button>:null}
          </fieldset>
        </form>
      </details>:null}
      {editable?<details className={styles.details}>
        <summary><ImagePlus size={17}/> Photo & education certificates <ChevronRight size={16}/></summary>
        <div className={styles.files}>
          <p>Save the personal details above first. Files are malware-scanned and stored in a private employee vault.</p>
          <label>Profile photo (JPEG/PNG/WebP, max 2 MB)<input type="file" accept="image/jpeg,image/png,image/webp"
            onChange={e=>setPhotoFile(e.target.files?.[0]||null)}/></label>
          <button disabled={busy||!photoFile||!profile} type="button" onClick={()=>void upload("PHOTO")}><Upload size={16}/> Upload scanned photo</button>
          <label>Certificate name<input maxLength={140} value={certificateLabel}
            onChange={e=>setCertificateLabel(e.target.value)}/></label>
          <label>Certificate PDF (max 10 MB)<input type="file" accept="application/pdf"
            onChange={e=>setCertificateFile(e.target.files?.[0]||null)}/></label>
          <button disabled={busy||!certificateFile||!certificateLabel.trim()||!profile} type="button" onClick={()=>void upload("CERTIFICATE")}><Upload size={16}/> Upload scanned certificate</button>
          {profile?.certificates?.map((item,i)=><small key={i}>{item.label} · {item.review_status||"PENDING"}</small>)}
        </div>
      </details>:null}
      {editable?<button type="button" className={styles.primary} disabled={busy||!profile}
        onClick={()=>void post({action:"SUBMIT"},"Onboarding submitted for independent HR review.")}>
        <ShieldCheck size={16}/> Submit complete onboarding for HR review
      </button>:null}
      {reviewed?<div className={styles.hrActions}>
        <p>All actions are audited. Review signed appointment evidence, actual Finance verification and effective employment dates before issuing a permanent ID.</p>
        <label>Decision reason / evidence<input minLength={12} maxLength={1000} value={reason}
          onChange={e=>setReason(e.target.value)}/></label>
        <label>Independent Finance bank-verification evidence reference
          <input value={bankEvidence} minLength={8} maxLength={400} placeholder="Verified Finance record reference"
            onChange={e=>setBankEvidence(e.target.value)}/>
        </label>
        <div className={styles.row}>
          <button disabled={busy||reason.trim().length<12||bankEvidence.trim().length<8||!profile?.bank_account_last4||Boolean(profile.bank_verified_at)}
            onClick={()=>void post({action:"VERIFY_BANK",employee_id:state.employee_user_id,evidence_reference:bankEvidence,reason},
              "Bank details marked independently reviewed.",state.employee_user_id)}><Wallet size={16}/> Verify bank (Finance)</button>
          <button disabled={busy||reason.trim().length<12||profile?.status!=="SUBMITTED"}
            onClick={()=>void post({action:"REVIEW",employee_id:state.employee_user_id,decision:"RETURN",reason},
              "Returned for employee correction.",state.employee_user_id)}>Return for correction</button>
          <button disabled={busy||reason.trim().length<12||profile?.status!=="SUBMITTED"||!profile.bank_verified_at}
            onClick={()=>void post({action:"REVIEW",employee_id:state.employee_user_id,decision:"VERIFY",reason},
              "Employee onboarding independently verified.",state.employee_user_id)}><BadgeCheck size={16}/> Verify onboarding</button>
          <button disabled={busy||reason.trim().length<12||profile?.status!=="VERIFIED"||Boolean(state.permanent_employee_id)}
            onClick={()=>void post({action:"ISSUE_ID",employee_id:state.employee_user_id,reason},
              "Permanent employee ID issued; corporate mail is queued, not yet sent.",state.employee_user_id)}>
            <IdCard size={16}/> Issue permanent ID
          </button>
        </div>
        <small>Employee ID email remains pending until the corporate transactional delivery worker acknowledges it.</small>
      </div>:null}
      <div className={styles.disclaimer}><FileText size={16}/>{state.note}</div>
    </>}
  </section>;
}
