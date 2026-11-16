"use client";
import Link from "next/link";
import { useCallback,useEffect,useMemo,useState } from "react";
import { BriefcaseBusiness,CheckCircle2,ClipboardCheck,FileCheck2,Globe,LoaderCircle,Mail,RefreshCw,ShieldAlert } from "lucide-react";
import styles from "./office-careers-publishing.module.css";

type Requisition={id:string;requisition_code:string;position_code:string;department_code:string;status:string;approved_at:string|null;openings:number};
type Publication={id:string;requisition_id:string;slug:string;title:string;summary:string;description:string;requirements:string;benefits:string;status:string;expires_at:string|null;version:number};
type Applicant={id:string;application_code:string;requisition_id:string;candidate_id:string|null;full_name:string;email:string;status:string;verified_at:string|null;resume_scan_status:string;resume_filename:string|null;communication_requested:boolean};
type Decision={id:string;application_id:string;candidate_id:string|null;offer_id:string|null;action_type:string;status:string;typed_name:string|null;created_at:string};
type Consent={candidate_id:string;status:string};
type Upload={id:string;application_id:string;candidate_id:string;document_request_id:string;original_filename:string;status:string;submitted_at:string};
type Handoff={application_id:string;candidate_id:string;offer_id:string;pre_onboarding_request_id:string;employee_user_id:string|null;status:string;created_at:string};
type EmployeeOption={user_id:string;display_name:string;primary_department:string|null};
type EmailEvent={id:string;application_id:string;event_type:string;status:string;created_at:string;completed_at:string|null};
type MailPolicy={event_code:string;source_ready:boolean;enabled:boolean;delivery_owner:string;approved_at:string|null};
type Outbox={id:string;candidate_id:string;event_code:string;status:string;created_at:string;finalized_at:string|null};
type Overview={canPublish:boolean;requisitions:Requisition[];publications:Publication[];applications:Applicant[];candidateActions:Decision[];candidateConsents:Consent[];candidateUploads:Upload[];handoffs:Handoff[];emailEvents:EmailEvent[];mailPolicies:MailPolicy[];candidateOutbox:Outbox[];canManageOnboarding:boolean;employeeOptions:EmployeeOption[];notice:string};
type Draft={requisition_id:string;slug:string;title:string;summary:string;description:string;requirements:string;benefits:string;expires_at:string};
function label(value:string){return value.replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());}
export function OfficeCareersPublishing() {
  const [data,setData]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [draft,setDraft]=useState<Draft|null>(null);
  const [employeeSelections,setEmployeeSelections]=useState<Record<string,string>>({});
  const [tab,setTab]=useState<"VACANCIES"|"APPLICATIONS"|"RESPONSES"|"COMMUNICATIONS">("VACANCIES");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/office-careers",{cache:"no-store",credentials:"same-origin"});
      const json=await response.json();
      if(!response.ok)throw new Error(json.detail||"HR Careers control center unavailable");
      setData(json as Overview);
    }catch(e){setError(e instanceof Error?e.message:"Recruitment data could not be loaded");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const publications=useMemo(()=>new Map((data?.publications||[]).map(x=>[x.requisition_id,x])),[data]);
  const candidates=useMemo(()=>new Map((data?.applications||[]).map(x=>[x.id,x])),[data]);
  const consents=useMemo(()=>new Map((data?.candidateConsents||[]).map(x=>[x.candidate_id,x])),[data]);
  const handoffs=useMemo(()=>new Map((data?.handoffs||[]).map(x=>[x.application_id,x])),[data]);
  async function run(payload:Record<string,unknown>,success:string){
    if(working)return;
    const id=String(payload.action||"ACTION");setWorking(id);setError("");setNotice("");
    try{
      const response=await fetch("/api/office-careers",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)});
      const json=await response.json();
      if(!response.ok)throw new Error(json.detail||"Authorized HR action failed");
      setNotice(success);setDraft(null);await load();
    }catch(e){setError(e instanceof Error?e.message:"Authorized HR action failed");}
    finally{setWorking("");}
  }
  function begin(req:Requisition){
    const pub=publications.get(req.id);
    setDraft({
      requisition_id:req.id,
      slug:pub?.slug||req.position_code.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""),
      title:pub?.title||label(req.position_code),
      summary:pub?.summary||"",
      description:pub?.description||"",
      requirements:pub?.requirements||"",
      benefits:pub?.benefits||"",
      expires_at:pub?.expires_at?.slice(0,16)||"",
    });
  }
  if(loading&&!data)return <div className={styles.state}><LoaderCircle className={styles.spin}/>Loading approved Careers publication controls…</div>;
  return <section className={styles.shell} aria-label="Public Careers publishing and applicant intake">
    <header className={styles.head}>
      <div><p className={styles.eyebrow}><Globe size={14}/> PUBLIC CAREERS / PRIVATE HR HANDOFF</p>
        <h2>Careers publishing &amp; applicant intake</h2>
        <p>Only approved openings are public. Applicants verify their own email before independent HR adoption.</p></div>
      <button type="button" onClick={()=>void load()} disabled={loading||!!working}><RefreshCw size={15}/> Refresh</button>
    </header>
    <div className={styles.tabs} role="tablist" aria-label="Career management">
      {(["VACANCIES","APPLICATIONS","RESPONSES","COMMUNICATIONS"] as const).map(t=>
        <button type="button" key={t} role="tab" aria-selected={tab===t} data-active={tab===t} onClick={()=>{setTab(t);setDraft(null);}}>
          {label(t)}
          <span>{t==="VACANCIES"?data?.publications.length||0:t==="APPLICATIONS"?data?.applications.length||0:t==="RESPONSES"?data?.candidateActions.filter(a=>a.status==="SUBMITTED").length||0:data?.emailEvents.filter(e=>e.status==="FAILED"||e.status==="UNKNOWN").length||0}</span>
        </button>
      )}
    </div>
    {error?<div className={styles.error} role="alert"><ShieldAlert size={17}/>{error}<button onClick={()=>void load()} type="button">Retry</button></div>:null}
    {notice?<div role="status" className={styles.notice}><CheckCircle2 size={16}/>{notice}</div>:null}
    {!data?<p>HR records are unavailable. No blank data is treated as approved.</p>:null}
    {data&&tab==="VACANCIES"?<div className={styles.grid}>
      {data.requisitions.map(req=>{
        const pub=publications.get(req.id);
        return <article className={styles.card} key={req.id}>
          <div className={styles.row}><code>{req.requisition_code}</code><span className={styles.status}>{pub?.status||"NOT_PUBLISHED"}</span></div>
          <h3>{pub?.title||label(req.position_code)}</h3>
          <p>{req.department_code} · {req.openings} approved position(s) · {req.status}</p>
          <p className={styles.small}>{pub?.summary||"This requisition has no public description."}</p>
          <div className={styles.controls}>
            {data.canPublish&&req.status==="OPEN"&&!!req.approved_at
              ?<button type="button" disabled={!!working} onClick={()=>begin(req)}><BriefcaseBusiness size={14}/> {pub?"Edit publication":"Publish vacancy"}</button>
              :<span>Await approved open requisition</span>}
            {pub?.status==="PUBLISHED"?<>
              <Link href={"/careers/"+pub.slug} target="_blank">View public job</Link>
              <button type="button" disabled={!!working||!data.canPublish}
                onClick={()=>void run({action:"PAUSE",requisition_id:req.id},"Public vacancy paused; existing applications retained.")}>
                Pause
              </button>
            </>:null}
          </div>
        </article>;
      })}
      {!data.requisitions.length?<p className={styles.empty}>No approved hiring requisitions in your permitted scope.</p>:null}
    </div>:null}
    {draft&&tab==="VACANCIES"?<form className={styles.form} onSubmit={event=>{
      event.preventDefault();
      void run({
        action:"PUBLISH",...draft,expires_at:draft.expires_at?new Date(draft.expires_at).toISOString():null
      },"Approved vacancy published on the public Careers website.");
    }}>
      <div className={styles.row}><h3>Public listing · {draft.requisition_id.slice(0,8)}</h3>
        <button type="button" onClick={()=>setDraft(null)}>Cancel</button></div>
      {([
        ["slug","Public URL slug",120],
        ["title","Job title",140],
        ["summary","Short job summary",1000],
        ["description","Full duties and scope",12000],
        ["requirements","Requirements and eligibility",8000],
        ["benefits","Benefits and conditions",8000],
      ] as Array<[keyof Draft,string,number]>).map(([field,title,max])=>
        <label key={field}>{title}{field==="description"||field==="requirements"||field==="benefits"||field==="summary"
          ?<textarea value={draft[field]} required={field==="description"||field==="summary"} maxLength={max}
              onChange={e=>setDraft({...draft,[field]:e.target.value})} rows={field==="description"?5:3}/>
          :<input value={draft[field]} required maxLength={max}
              onChange={e=>setDraft({...draft,[field]:e.target.value})}/>}</label>
      )}
      <label>Application deadline (optional)<input type="datetime-local" value={draft.expires_at}
        onChange={e=>setDraft({...draft,expires_at:e.target.value})}/></label>
      <p>Publishing confirms that headcount is already approved. Salary budgets and internal interview records will never be published.</p>
      <button className={styles.primary} type="submit" disabled={!!working}>{working?"Publishing…":"Publish approved job"}</button>
    </form>:null}
    {data&&tab==="APPLICATIONS"?<div className={styles.grid}>
      {data.applications.map(app=>{const consent=app.candidate_id?consents.get(app.candidate_id):null;const handoff=handoffs.get(app.id);const uploads=data.candidateUploads.filter(u=>u.application_id===app.id);
        return <article className={styles.card} key={app.id}>
          <div className={styles.row}><code>{app.application_code}</code><span className={styles.status}>{label(app.status)}</span></div>
          <h3>{app.full_name}</h3>
          <p>{app.email}</p>
          <p className={styles.small}>{data.requisitions.find(r=>r.id===app.requisition_id)?.position_code||"Job"} · Email {app.verified_at?"verified":"not verified"} · Resume {label(app.resume_scan_status)}</p>
          <div className={styles.controls}>
            {app.status==="VERIFIED"&&!app.candidate_id?<button disabled={!!working} type="button"
              onClick={()=>void run({action:"IMPORT_VERIFIED",application_id:app.id},"Verified applicant imported into the canonical ATS.")}>
              <ClipboardCheck size={14}/> Import to ATS
            </button>:null}
            {app.candidate_id&&app.resume_scan_status==="QUARANTINED"?<button disabled={!!working} type="button"
              onClick={()=>void run({action:"SCAN_RESUME",application_id:app.id},"Resume scanned and stored in the private HR vault.")}>
              <FileCheck2 size={14}/> Malware scan &amp; retain
            </button>:null}
            {app.candidate_id&&app.communication_requested&&!consent?<button disabled={!!working} type="button"
              onClick={()=>{const reason=window.prompt("Document the verified applicant's communication request and privacy notice (minimum 12 characters).");if(reason)void run({action:"RECORD_CONSENT",application_id:app.id,reason},"Consent evidence queued for independent review.");}}>
              <Mail size={14}/> Record mail consent evidence
            </button>:null}
            {app.candidate_id&&consent?.status==="PENDING"?<button disabled={!!working} type="button"
              onClick={()=>{const reason=window.prompt("Independent consent review evidence (minimum 12 characters).");if(reason)void run({action:"REVIEW_CONSENT",candidate_id:app.candidate_id,approved:true,reason},"Consent independently approved.");}}>
              Verify consent independently
            </button>:null}
          </div>
          {consent?<small>Candidate communication consent: {label(consent.status)}. Mail events also require separately enabled Owner policy.</small>:null}
          {uploads.length>0?<div className={styles.form} style={{padding:9,gap:7}}>
            <strong style={{fontSize:11}}>Candidate-submitted documents</strong>
            {uploads.map(upload=><div key={upload.id} className={styles.row}>
              <span style={{fontSize:11,overflowWrap:"anywhere"}}>{upload.original_filename} · {label(upload.status)}</span>
              {upload.status==="QUARANTINED"?<button type="button" disabled={!!working}
                onClick={()=>void run({action:"SCAN_CANDIDATE_DOCUMENT",upload_id:upload.id},"File scanned with a verified SHA-256 attestation; independent document review is still required.")}>
                <FileCheck2 size={14}/> Scan into vault
              </button>:null}
            </div>)}
          </div>:null}
          {handoff?<div className={styles.form} style={{padding:10,gap:8}}>
            <strong style={{fontSize:12}}>Approved-offer onboarding handoff</strong>
            <p>Status: {label(handoff.status)} · Approval request: {handoff.pre_onboarding_request_id.slice(0,8)}…</p>
            <div className={styles.controls}><Link href="/office/approvals">Review independent approval</Link>
              <Link href="/office/people">Complete employee verification</Link></div>
            {data.canManageOnboarding&&handoff.status!=="EMPLOYEE_LINKED"?<>
              <label>Match the verified KRAVIA employee identity
                <select value={employeeSelections[app.id]||""}
                  onChange={e=>setEmployeeSelections(old=>({...old,[app.id]:e.target.value}))}>
                  <option value="">Select active verified employee</option>
                  {data.employeeOptions.map(employee=><option key={employee.user_id} value={employee.user_id}>
                    {employee.display_name} · {employee.primary_department||"Unassigned"}
                  </option>)}
                </select>
              </label>
              <button type="button" disabled={!!working||!employeeSelections[app.id]}
                onClick={()=>{if(window.confirm("Link only after signed offer, independently approved onboarding, matching employee email/department, verified intake, verified bank, actual joining date and employee ID. Continue?")){
                  void run({action:"LINK_VERIFIED_EMPLOYEE",application_id:app.id,employee_user_id:employeeSelections[app.id]},"Governed candidate-to-employee linkage completed.");
                }}}>Verify and finish employee handover</button>
            </>:null}
            {handoff.status==="EMPLOYEE_LINKED"?<small>Employee linkage recorded. Office access remains governed by the separate IAM assignment.</small>:null}
          </div>:null}
        </article>;
      })}
      {!data.applications.length?<p className={styles.empty}>No public applicants yet. The application form accepts applicants only for published, approved vacancies.</p>:null}
    </div>:null}
    {data&&tab==="RESPONSES"?<div className={styles.grid}>
      {data.candidateActions.map(action=><article className={styles.card} key={action.id}>
        <div className={styles.row}><code>{action.action_type}</code><span className={styles.status}>{action.status}</span></div>
        <h3>{candidates.get(action.application_id)?.full_name||"Applicant response"}</h3>
        <p className={styles.small}>Received {new Date(action.created_at).toLocaleString("en-IN")}. Candidate responses are evidence, not HR approval.</p>
        {action.action_type==="OFFER_ACKNOWLEDGED"&&action.status==="SUBMITTED"?
          <div className={styles.controls}><button type="button" disabled={!!working}
            onClick={()=>void run({action:"REVIEW_OFFER_ACK",action_id:action.id},"Signed offer proof confirmed and pre-onboarding request created.")}>
            <CheckCircle2 size={14}/> Verify signed offer &amp; request onboarding
          </button></div>:null}
        {action.action_type==="RESCHEDULE_REQUEST"?<p className={styles.small}>An HR interviewer must independently reschedule in the Interviews tab; no automatic calendar change.</p>:null}
        {action.action_type==="WITHDRAWAL"?<p className={styles.small}>Close the linked candidate in Recruitment after verifying the withdrawal; this record is retained for audit.</p>:null}
      </article>)}
      {!data.candidateActions.length?<p className={styles.empty}>Candidate confirmations and offer responses will appear here after verified submission.</p>:null}
    </div>:null}
    {data&&tab==="COMMUNICATIONS"?<div className={styles.grid}>
      <article className={styles.card}>
        <h3>Transactional candidate email outcomes</h3>
        <p>Provider acceptance is recorded separately from inbox delivery. UNKNOWN is not automatically retried.</p>
        {data.emailEvents.slice(0,80).map(mail=><div key={mail.id} className={styles.row}>
          <span style={{fontSize:11}}>{candidates.get(mail.application_id)?.application_code||"Applicant"} · {label(mail.event_type)}</span>
          <span className={styles.status}>{label(mail.status)}</span>
        </div>)}
        {!data.emailEvents.length?<p className={styles.empty}>No transactional candidate notices have been issued.</p>:null}
      </article>
      <article className={styles.card}>
        <h3>Owner-controlled hiring communication policies</h3>
        <p>HIRE lifecycle events remain disabled until Owner authorization, verified candidate consent, sender identity and worker health are confirmed.</p>
        {data.mailPolicies.map(policy=><div key={policy.event_code} className={styles.row}>
          <code>{policy.event_code}</code>
          <span style={{fontSize:11}}>{policy.enabled&&policy.source_ready?"Enabled":"Awaiting approval"}</span>
        </div>)}
        {!data.mailPolicies.length?<p>Lifecycle mail configuration is unavailable. Do not assume delivery is enabled.</p>:null}
        <Link href="/office/settings">Owner: review notification controls</Link>
      </article>
      <article className={styles.card}>
        <h3>Existing candidate-worker outbox</h3>
        {data.candidateOutbox.slice(0,80).map(item=><div key={item.id} className={styles.row}>
          <code>{item.event_code}</code><span className={styles.status}>{label(item.status)}</span>
        </div>)}
        {!data.candidateOutbox.length?<p className={styles.empty}>No candidate worker notices have entered the approved delivery queue.</p>:null}
      </article>
    </div>:null}
    {data?<p className={styles.foot}>Public listings are linked to approved headcount. Resume documents remain quarantined until independently scanned. Only the existing approved Office workflow may activate onboarding or employee access.</p>:null}
  </section>;
}
