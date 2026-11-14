"use client";

import { useCallback,useEffect,useState } from "react";
import { AlertTriangle,CheckCircle2,FileSpreadsheet,FileUp,LoaderCircle,RefreshCw,ShieldCheck } from "lucide-react";
import styles from "./office-hr-attendance-import.module.css";

type Candidate={
  key:string;sheet:string;row:number;employee:string;workDate:string;
  payableMinutes:number;paidLeaveMinutes:number;overtimeCandidateMinutes:number;
  evidenceReference:string;workbookDecision:string;sourceStatus:string;
  employeeUserId:string|null;eligible:boolean;
};
type Issue={sheet:string;row:number;employee:string;severity:"ERROR"|"WARNING";detail:string};
type Preview={
  fileName:string;fileSha256:string;sourceSessions:number;sheetsRead:string[];
  ignoredUneditedDays:number;candidates:Candidate[];issues:Issue[];
  readyToStage:boolean;existingBatchId:string|null;notice:string;
};
type Batch={
  id:string;file_name:string;file_sha256:string;created_by:string;row_count:number;
  status:string;created_at:string;
};
type ImportRow={
  id:string;batch_id:string;row_key:string;employee_user_id:string;
  source_sheet:string;source_row:number;work_date:string;
  payable_candidate_minutes:number;paid_leave_candidate_minutes:number;
  overtime_candidate_minutes:number;evidence_reference:string;
  workbook_decision:string;status:string;reviewed_by:string|null;review_note:string|null;
};
type History={batches:Batch[];rows:ImportRow[];actorId:string;people:Array<{user_id:string;display_name:string|null}>};
async function http<T>(url:string,config?:RequestInit):Promise<T>{
  const response=await fetch(url,{...config,cache:"no-store",credentials:"same-origin"});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(typeof body.detail==="string"?body.detail:"Private HR import service unavailable");
  return body as T;
}
function asDate(ts:string){return new Date(ts).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"});}
const importApi="/api/office-hr-attendance-import";

export function OfficeHrAttendanceImport(){
  const [selected,setSelected]=useState<File|null>(null);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [history,setHistory]=useState<History|null>(null);
  const [batchId,setBatchId]=useState("");
  const [note,setNote]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [showAll,setShowAll]=useState(false);
  const loadHistory=useCallback(async(id?:string)=>{
    const result=await http<History>(importApi+(id?"?batch="+encodeURIComponent(id):""));
    setHistory(result);
    setBatchId(id||result.batches[0]?.id||"");
  },[]);
  useEffect(()=>{
    let active=true;
    void http<History>(importApi).then(data=>{
      if(active){setHistory(data);setBatchId(data.batches[0]?.id||"");}
    }).catch(err=>{if(active)setError(err instanceof Error?err.message:"No authorized HR access");});
    return ()=>{active=false;};
  },[]);
  async function upload(action:"PREVIEW"|"STAGE"){
    if(!selected)return;
    setLoading(true);setError("");setMessage("");
    try{
      const form=new FormData();
      form.append("file",selected,selected.name);
      form.append("action",action);
      if(action==="PREVIEW"){
        const result=await http<Preview>(importApi,{method:"POST",body:form});
        setPreview(result);
        setMessage(result.readyToStage?
          "Extraction complete. This is not attendance or salary approval. Review each record before staging.":
          "Extraction complete. Resolve all errors before staging.");
      }else {
        const result=await http<{batchId:string;rowsStaged:number;notice:string}>(
          importApi,{method:"POST",body:form});
        setPreview(null);setSelected(null);
        await loadHistory(result.batchId);
        setMessage(result.rowsStaged+" source rows staged. "+result.notice);
      }
    }catch(err){setError(err instanceof Error?err.message:"Workbook upload failed");}
    finally{setLoading(false);}
  }
  async function review(row:ImportRow,decision:"ACCEPT"|"REJECT"){
    const reviewNote=(note[row.id]||"").trim();
    if(reviewNote.length<12){setError("Enter at least 12 characters explaining your independent evidence review");return;}
    setLoading(true);setError("");setMessage("");
    try {
      await http(importApi,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        action:"REVIEW_ROW",rowId:row.id,decision,note:reviewNote,
      })});
      setNote(old=>({...old,[row.id]:""}));
      await loadHistory(row.batch_id);
      setMessage("Workbook evidence "+(decision==="ACCEPT"?"accepted":"rejected")+
        ". No attendance timestamps, payroll, overtime or wages were changed.");
    }catch(err){setError(err instanceof Error?err.message:"Independent review failed");}
    finally{setLoading(false);}
  }
  const names=new Map((history?.people||[]).map(p=>[p.user_id,p.display_name||"Office employee"]));
  const owner=history?.batches.find(b=>b.id===batchId);
  const active=history?.rows||[];
  const visible=showAll?preview?.candidates||[]:(preview?.candidates||[]).slice(0,40);
  return <section className={styles.shell} id="attendance-import">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>KRAVIA OFFICE · HR EVIDENCE</span>
        <h2>Upload &amp; Extract Attendance</h2>
        <p>Import the August–November reconciliation workbook into a private, audited HR review queue.</p></div>
      <FileSpreadsheet size={28} aria-hidden="true"/>
    </header>
    <div className={styles.warning}><AlertTriangle size={18}/>
      <span>The Excel sheet is evidence, not an approval. No imported figure modifies existing check-ins, approved leave, overtime, gross salary, payroll or bank transfers.</span>
    </div>
    {error?<div role="alert" className={styles.error}><AlertTriangle size={17}/>{error}</div>:null}
    {message?<div role="status" className={styles.notice}><CheckCircle2 size={17}/>{message}</div>:null}
    <div className={styles.panel}>
      <h3>1 · Select the completed HR workbook</h3>
      <label className={styles.file}>
        <FileUp size={19}/>
        <span>{selected?selected.name:"Choose KRAVIA attendance reconciliation (.xlsx)"}</span>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={loading} onChange={e=>{
            setSelected(e.target.files?.[0]||null);setPreview(null);setError("");setMessage("");
          }}/>
      </label>
      <p>Supported: the original Source Sessions plus Aug, Sep, Oct and Nov 2026 sheets. Fill monthly columns J–N and keep source columns unchanged. Maximum file size 2 MiB.</p>
      <div className={styles.actions}>
        <button type="button" onClick={()=>void upload("PREVIEW")} disabled={!selected||loading}>
          {loading?<LoaderCircle size={16}/>:<FileSpreadsheet size={16}/>} Extract &amp; validate
        </button>
        <button type="button" onClick={()=>void upload("STAGE")}
          disabled={!selected||!preview?.readyToStage||loading}>
          <ShieldCheck size={16}/> Stage for HR review
        </button>
      </div>
      <p className={styles.note}>The uploaded workbook is parsed in memory; only the file fingerprint and extracted evidence fields are staged. The original file is not publicly stored.</p>
    </div>
    {preview?<div className={styles.panel}>
      <h3>2 · Extraction preview</h3>
      <div className={styles.summary}>
        <span><strong>{preview.candidates.length}</strong><small>Edited daily rows</small></span>
        <span><strong>{preview.sourceSessions}</strong><small>Original source sessions</small></span>
        <span><strong>{preview.issues.filter(i=>i.severity==="ERROR").length}</strong><small>Blocking errors</small></span>
        <span><strong>{preview.issues.filter(i=>i.severity==="WARNING").length}</strong><small>Review warnings</small></span>
      </div>
      {preview.issues.length?<div className={styles.issues}>
        <h4>Exceptions to review</h4>
        {preview.issues.slice(0,80).map((issue,i)=><div className={styles.issue} key={i}>
          <strong>{issue.severity}</strong><span>{issue.sheet} · row {issue.row} · {issue.employee}</span>
          <span>{issue.detail}</span>
        </div>)}
        {preview.issues.length>80?<p>{preview.issues.length-80} more exceptions; correct the workbook and extract again.</p>:null}
      </div>:null}
      {visible.length?<div className={styles.scroll}>
        <table><thead><tr><th>Employee</th><th>Work date</th><th>Verified min</th>
          <th>Paid leave</th><th>OT candidate</th><th>Source</th><th>Result</th></tr></thead>
          <tbody>{visible.map(row=><tr key={row.key}>
            <td>{row.employee}</td><td>{row.workDate}</td><td>{row.payableMinutes}</td>
            <td>{row.paidLeaveMinutes}</td><td>{row.overtimeCandidateMinutes}</td>
            <td>{row.evidenceReference}</td><td>{row.eligible?"Review required":"Blocked"}</td>
          </tr>)}</tbody>
        </table>
      </div>:null}
      {!showAll&&preview.candidates.length>40?<button type="button" className={styles.linkButton}
        onClick={()=>setShowAll(true)}>Show all {preview.candidates.length} extracted days</button>:null}
      <p>{preview.ignoredUneditedDays} unchanged/no-evidence days were intentionally not imported. Missing time is not treated as unpaid absence.</p>
    </div>:null}
    <div className={styles.panel}>
      <div className={styles.heading}><h3>3 · Private HR review history</h3>
        <button type="button" disabled={loading} onClick={()=>void loadHistory(batchId)}><RefreshCw size={15}/> Refresh</button></div>
      {history?.batches.length?<label className={styles.batchLabel}>Uploaded batch
        <select value={batchId} onChange={e=>void loadHistory(e.target.value)}>
          {history.batches.map(batch=><option key={batch.id} value={batch.id}>
            {batch.file_name} · {batch.row_count} rows · {batch.status} · {asDate(batch.created_at)}
          </option>)}
        </select>
      </label>:<p>No workbook has been staged. HR can extract a completed sheet above.</p>}
      {owner?<p>Uploaded by {names.get(owner.created_by)||"HR operator"}. Every row requires a separate evidence decision. The uploader and the beneficiary cannot accept their own entry.</p>:null}
      {active.length?<div className={styles.entries}>
        {active.map(row=><article className={styles.entry} key={row.id}>
          <div><strong>{names.get(row.employee_user_id)||"Employee"} · {row.work_date}</strong>
            <small>{row.source_sheet} row {row.source_row} · regular {row.payable_candidate_minutes}m · paid leave {row.paid_leave_candidate_minutes}m · OT candidate {row.overtime_candidate_minutes}m</small>
            <small>Evidence: {row.evidence_reference}</small>
            {row.review_note?<small>Review: {row.review_note}</small>:null}
          </div>
          <div className={styles.decision}><strong>{row.status}</strong>
            {row.status==="PENDING"&&history?.actorId!==owner?.created_by&&
              history?.actorId!==row.employee_user_id?<>
              <textarea placeholder="Describe the actual source you inspected (at least 12 characters)"
                aria-label={"Independent review note for "+row.work_date}
                value={note[row.id]||""} onChange={e=>setNote(p=>({...p,[row.id]:e.target.value}))}/>
              <div className={styles.actions}>
                <button type="button" disabled={loading||!note[row.id]||note[row.id].trim().length<12}
                  onClick={()=>void review(row,"ACCEPT")}>Accept evidence</button>
                <button type="button" disabled={loading||!note[row.id]||note[row.id].trim().length<12}
                  onClick={()=>void review(row,"REJECT")}>Reject</button>
              </div>
              </>:row.status==="PENDING"?<small>Awaiting an independent HR reviewer</small>:null}
          </div>
        </article>)}
      </div>:null}
      <p className={styles.note}>Accepting a workbook row means source evidence was independently reviewed. HR must still use the separate approved attendance, leave, and payroll processes before any payable calculation.</p>
    </div>
  </section>;
}
