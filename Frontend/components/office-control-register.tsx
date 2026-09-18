"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleAlert, LoaderCircle, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import styles from "./office-control-register.module.css";

type Capabilities={
  read_risk:boolean;manage_risk:boolean;review_risk:boolean;
  read_decision:boolean;record_decision:boolean;
  read_change:boolean;manage_change:boolean;review_change:boolean;
};
type Person={user_id:string;display_name?:string|null;job_title?:string|null};
type Risk={id:string;risk_code:string;title:string;category:string;description:string;owner_user_id:string;department_code?:string|null;likelihood:number;impact:number;treatment:string;residual_likelihood?:number|null;residual_impact?:number|null;status:string;review_on?:string|null;acceptance_basis?:string|null;closure_evidence_reference?:string|null};
type RiskAction={id:string;action_code:string;risk_id:string;title:string;owner_user_id:string;due_on?:string|null;status:string;evidence_reference?:string|null;note?:string|null};
type Decision={id:string;decision_code:string;title:string;category:string;context:string;decision_text:string;decision_maker_user_id:string;decision_at:string;authority_basis:string;approval_reference?:string|null;effective_from?:string|null;review_on?:string|null;status:string};
type Change={id:string;change_code:string;change_kind:string;title:string;description:string;owner_user_id:string;department_code?:string|null;risk_summary?:string|null;implementation_plan:string;rollback_plan?:string|null;approval_reference?:string|null;effective_at?:string|null;status:string;verification_evidence_reference?:string|null};
type Payload={actor:{user_id:string;department?:string|null};capabilities:Capabilities;people:Person[];risks:Risk[];risk_actions:RiskAction[];decisions:Decision[];changes:Change[];disclaimer:string};
type View="risks"|"decisions"|"changes";
type Modal=
  |{kind:"CREATE_RISK"}
  |{kind:"UPDATE_RISK";risk:Risk}
  |{kind:"RISK_ACTION";risk:Risk}
  |{kind:"ACTION_STATUS";action:RiskAction}
  |{kind:"DECISION"}
  |{kind:"REVOKE_DECISION";decision:Decision}
  |{kind:"CHANGE"}
  |{kind:"CHANGE_STATUS";change:Change};

async function api<T>(options?:RequestInit):Promise<T>{
  const response=await fetch("/api/office-control-register",{...options,cache:"no-store",credentials:"same-origin"});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(typeof body.detail==="string"?body.detail:"Enterprise control request failed");
  return body as T;
}
function date(value?:string|null){
  if(!value)return "—";
  const d=new Date(value);
  return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:value.length>10?"short":undefined}).format(d);
}
function toIso(value?:string){if(!value)return undefined;const d=new Date(value);return Number.isNaN(d.getTime())?undefined:d.toISOString()}
function riskScore(row:Risk){return row.likelihood*row.impact}
function nextChangeStates(row:Change,canReview:boolean){
  if(row.status==="PROPOSED")return canReview?["APPROVED","REJECTED"]:[];
  if(row.status==="APPROVED")return ["IN_PROGRESS","ROLLED_BACK"];
  if(row.status==="IN_PROGRESS")return canReview?["VERIFIED","ROLLED_BACK"]:["ROLLED_BACK"];
  if(row.status==="VERIFIED")return canReview?["CLOSED"]:[];
  return [];
}

export function OfficeControlRegister(){
  const[data,setData]=useState<Payload>();
  const[view,setView]=useState<View>("risks");
  const[modal,setModal]=useState<Modal>();
  const[draft,setDraft]=useState<Record<string,string>>({});
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState<string>();
  const[notice,setNotice]=useState<string>();

  async function reload(message?:string){const next=await api<Payload>();setData(next);if(message)setNotice(message)}
  useEffect(()=>{let alive=true;void api<Payload>().then(next=>{if(alive)setData(next)}).catch((caught:unknown)=>{if(alive)setError(caught instanceof Error?caught.message:"Unable to load enterprise controls")});return()=>{alive=false}},[]);
  const people=useMemo(()=>new Map((data?.people??[]).map(row=>[row.user_id,row])),[data?.people]);
  const actions=useMemo(()=>{const map=new Map<string,RiskAction[]>();for(const row of data?.risk_actions??[]){const list=map.get(row.risk_id)||[];list.push(row);map.set(row.risk_id,list)}return map},[data?.risk_actions]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!modal)return;
    setBusy(true);setError(undefined);
    try{
      if(modal.kind==="CREATE_RISK"){
        await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          action:"CREATE_RISK",title:draft.title,category:draft.category||"OPERATIONAL",description:draft.description,
          owner_user_id:draft.owner_user_id,department:draft.department||undefined,likelihood:Number(draft.likelihood||3),
          impact:Number(draft.impact||3),treatment:draft.treatment||"MITIGATE",review_on:draft.review_on||undefined,
          source_reference:draft.source_reference||undefined,
        })});
      }else if(modal.kind==="UPDATE_RISK"){
        await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          action:"UPDATE_RISK",risk_id:modal.risk.id,likelihood:Number(draft.likelihood),impact:Number(draft.impact),
          treatment:draft.treatment,status:draft.status,review_on:draft.review_on||undefined,
          residual_likelihood:draft.residual_likelihood?Number(draft.residual_likelihood):undefined,
          residual_impact:draft.residual_impact?Number(draft.residual_impact):undefined,
          acceptance_basis:draft.acceptance_basis||undefined,closure_evidence:draft.closure_evidence||undefined,note:draft.note||undefined,
        })});
      }else if(modal.kind==="RISK_ACTION"){
        await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          action:"CREATE_RISK_ACTION",risk_id:modal.risk.id,title:draft.title,owner_user_id:draft.owner_user_id,
          due_on:draft.due_on||undefined,note:draft.note||undefined,
        })});
      }else if(modal.kind==="ACTION_STATUS"){
        await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          action:"TRANSITION_RISK_ACTION",risk_action_id:modal.action.id,status:draft.status,
          evidence_reference:draft.evidence_reference||undefined,note:draft.note||undefined,
        })});
      }else if(modal.kind==="DECISION"){
        await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          action:"RECORD_DECISION",title:draft.title,category:draft.category||"OTHER",context:draft.context,decision:draft.decision,
          decision_maker_user_id:draft.decision_maker_user_id,decision_at:toIso(draft.decision_at),authority_basis:draft.authority_basis,
          approval_reference:draft.approval_reference||undefined,effective_from:draft.effective_from||undefined,
          review_on:draft.review_on||undefined,source_reference:draft.source_reference||undefined,
          supersedes_decision_id:draft.supersedes_decision_id||undefined,change_reason:draft.change_reason||undefined,
        })});
      }else if(modal.kind==="REVOKE_DECISION"){
        await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          action:"REVOKE_DECISION",decision_id:modal.decision.id,reason:draft.reason,
        })});
      }else if(modal.kind==="CHANGE"){
        await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          action:"CREATE_CHANGE",kind:draft.kind||"PROCESS",title:draft.title,description:draft.description,
          owner_user_id:draft.owner_user_id,department:draft.department||undefined,risk_summary:draft.risk_summary||undefined,
          implementation_plan:draft.implementation_plan,rollback_plan:draft.rollback_plan||undefined,effective_at:toIso(draft.effective_at),
        })});
      }else{
        await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          action:"TRANSITION_CHANGE",change_id:modal.change.id,status:draft.status,
          approval_reference:draft.approval_reference||undefined,verification_evidence:draft.verification_evidence||undefined,
          note:draft.note||undefined,
        })});
      }
      await reload("Enterprise control register updated.");
      setModal(undefined);setDraft({});
    }catch(caught){setError(caught instanceof Error?caught.message:"Enterprise control action failed")}
    finally{setBusy(false)}
  }

  if(error&&!data)return <section className={styles.state}><CircleAlert/><div><h2>Enterprise controls unavailable</h2><p>{error}</p></div></section>;
  if(!data)return <section className={styles.state}><LoaderCircle className={styles.spin}/><div><h2>Loading enterprise controls</h2><p>Resolving risk, decision and change authority.</p></div></section>;

  const openRisks=data.risks.filter(row=>row.status!=="CLOSED").length;
  const openChanges=data.changes.filter(row=>!["REJECTED","ROLLED_BACK","CLOSED"].includes(row.status)).length;
  const activeDecisions=data.decisions.filter(row=>row.status==="ACTIVE").length;

  return <section className={styles.shell}>
    <header className={styles.hero}>
      <div><p>RISK · DECISION · CONTROLLED CHANGE</p><h2>Record material company judgement without bypassing specialist approval workflows.</h2><span>{data.disclaimer}</span></div>
      <div className={styles.metrics}><article><b>{openRisks}</b><span>open risks</span></article><article><b>{activeDecisions}</b><span>active decisions</span></article><article><b>{openChanges}</b><span>open changes</span></article></div>
    </header>

    <div className={styles.toolbar}>
      {(["risks","decisions","changes"] as View[]).map(item=><button type="button" key={item} data-active={view===item} onClick={()=>setView(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}
      <button type="button" onClick={()=>void reload()}><RefreshCw/>Refresh</button>
      {view==="risks"&&data.capabilities.manage_risk?<button type="button" onClick={()=>{setDraft({category:"OPERATIONAL",likelihood:"3",impact:"3",treatment:"MITIGATE",department:data.actor.department||""});setModal({kind:"CREATE_RISK"})}}><Plus/>New risk</button>:null}
      {view==="decisions"&&data.capabilities.record_decision?<button type="button" onClick={()=>{setDraft({category:"OTHER"});setModal({kind:"DECISION"})}}><Plus/>Record decision</button>:null}
      {view==="changes"&&data.capabilities.manage_change?<button type="button" onClick={()=>{setDraft({kind:"PROCESS",department:data.actor.department||""});setModal({kind:"CHANGE"})}}><Plus/>Propose change</button>:null}
    </div>

    {notice?<div className={styles.notice}><BadgeCheck/>{notice}</div>:null}
    {error?<div className={styles.error}><CircleAlert/>{error}</div>:null}

    {view==="risks"?<div className={styles.list}>
      {data.risks.map(r=><article className={styles.card} key={r.id}>
        <header><div><code>{r.risk_code}</code><h3>{r.title}</h3><span>{r.category+(r.department_code?" · "+r.department_code:"")}</span></div><em className={styles.badge} data-status={r.status}>{r.status}</em></header>
        <p>{r.description}</p>
        <div className={styles.kv}><span>Owner<b>{people.get(r.owner_user_id)?.display_name||r.owner_user_id}</b></span><span>Risk score<b>{riskScore(r)} / 25</b></span><span>Treatment<b>{r.treatment}</b></span><span>Review<b>{date(r.review_on)}</b></span></div>
        {r.acceptance_basis?<p><b>Acceptance:</b> {r.acceptance_basis}</p>:null}
        {r.closure_evidence_reference?<p><b>Closure evidence:</b> {r.closure_evidence_reference}</p>:null}
        <div className={styles.actions}>
          {(data.capabilities.manage_risk||data.capabilities.review_risk)&&r.status!=="CLOSED"?<button type="button" onClick={()=>{setDraft({likelihood:String(r.likelihood),impact:String(r.impact),treatment:r.treatment,status:r.status,review_on:r.review_on||"",residual_likelihood:r.residual_likelihood?String(r.residual_likelihood):"",residual_impact:r.residual_impact?String(r.residual_impact):"",acceptance_basis:r.acceptance_basis||"",closure_evidence:r.closure_evidence_reference||"",note:""});setModal({kind:"UPDATE_RISK",risk:r})}}>Update risk</button>:null}
          {data.capabilities.manage_risk&&r.status!=="CLOSED"?<button type="button" onClick={()=>{setDraft({});setModal({kind:"RISK_ACTION",risk:r})}}>Add action</button>:null}
        </div>
        {(actions.get(r.id)||[]).map(a=><div className={styles.subrow} key={a.id}><div><b>{a.action_code} · {a.title}</b><span>{(people.get(a.owner_user_id)?.display_name||a.owner_user_id)+" · due "+date(a.due_on)}</span></div><em className={styles.badge} data-status={a.status}>{a.status.replaceAll("_"," ")}</em>{(a.owner_user_id===data.actor.user_id||data.capabilities.manage_risk)&&!["DONE","CANCELLED"].includes(a.status)?<button type="button" onClick={()=>{setDraft({status:a.status,evidence_reference:a.evidence_reference||"",note:a.note||""});setModal({kind:"ACTION_STATUS",action:a})}}>Update</button>:null}</div>)}
      </article>)}
      {!data.risks.length?<div className={styles.empty}>No risks in your authorised scope.</div>:null}
    </div>:null}

    {view==="decisions"?<div className={styles.list}>
      {data.decisions.map(d=><article className={styles.card} key={d.id}>
        <header><div><code>{d.decision_code}</code><h3>{d.title}</h3><span>{d.category+" · "+date(d.decision_at)}</span></div><em className={styles.badge} data-status={d.status}>{d.status}</em></header>
        <p><b>Decision:</b> {d.decision_text}</p><p className={styles.muted}>{d.context}</p>
        <div className={styles.kv}><span>Decision maker<b>{people.get(d.decision_maker_user_id)?.display_name||d.decision_maker_user_id}</b></span><span>Authority basis<b>{d.authority_basis}</b></span><span>Effective<b>{date(d.effective_from)}</b></span><span>Review<b>{date(d.review_on)}</b></span></div>
        {d.approval_reference?<p><b>Approval reference:</b> {d.approval_reference}</p>:null}
        {data.capabilities.record_decision&&d.status==="ACTIVE"?<div className={styles.actions}><button type="button" onClick={()=>{setDraft({reason:""});setModal({kind:"REVOKE_DECISION",decision:d})}}>Revoke with reason</button></div>:null}
      </article>)}
      {!data.decisions.length?<div className={styles.empty}>No decision records in your authorised scope.</div>:null}
    </div>:null}

    {view==="changes"?<div className={styles.list}>
      {data.changes.map(c=>{const next=nextChangeStates(c,data.capabilities.review_change);return <article className={styles.card} key={c.id}>
        <header><div><code>{c.change_code}</code><h3>{c.title}</h3><span>{c.change_kind+(c.department_code?" · "+c.department_code:"")}</span></div><em className={styles.badge} data-status={c.status}>{c.status.replaceAll("_"," ")}</em></header>
        <p>{c.description}</p>
        <div className={styles.kv}><span>Owner<b>{people.get(c.owner_user_id)?.display_name||c.owner_user_id}</b></span><span>Effective<b>{date(c.effective_at)}</b></span><span>Approval<b>{c.approval_reference||"—"}</b></span><span>Verification<b>{c.verification_evidence_reference||"—"}</b></span></div>
        <details><summary>Implementation & rollback</summary><p><b>Plan:</b> {c.implementation_plan}</p><p><b>Rollback:</b> {c.rollback_plan||"No rollback plan recorded"}</p>{c.risk_summary?<p><b>Risk:</b> {c.risk_summary}</p>:null}</details>
        {next.length&&(data.capabilities.manage_change||data.capabilities.review_change||c.owner_user_id===data.actor.user_id)?<div className={styles.actions}><button type="button" onClick={()=>{setDraft({status:next[0],approval_reference:c.approval_reference||"",verification_evidence:c.verification_evidence_reference||"",note:""});setModal({kind:"CHANGE_STATUS",change:c})}}>Advance / review</button></div>:null}
      </article>})}
      {!data.changes.length?<div className={styles.empty}>No controlled changes in your authorised scope.</div>:null}
    </div>:null}

    {modal?<div className={styles.backdrop} role="presentation" onMouseDown={()=>!busy&&setModal(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={e=>e.stopPropagation()}>
      <header><div><small>GOVERNED COMPANY CONTROL</small><h3>{modal.kind.replaceAll("_"," ")}</h3></div><button type="button" aria-label="Close" onClick={()=>setModal(undefined)}><X/></button></header>
      {modal.kind==="CREATE_RISK"?<><label>Title<input required minLength={3} value={draft.title||""} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><div className={styles.two}><label>Category<select value={draft.category||"OPERATIONAL"} onChange={e=>setDraft({...draft,category:e.target.value})}>{["FINANCIAL","OPERATIONAL","SECURITY","LEGAL","COMPLIANCE","PEOPLE","VENDOR","PRODUCT","CUSTOMER","INFRASTRUCTURE","PRIVACY","STRATEGIC","OTHER"].map(v=><option key={v}>{v}</option>)}</select></label><label>Owner<select required value={draft.owner_user_id||""} onChange={e=>setDraft({...draft,owner_user_id:e.target.value})}><option value="">Select owner</option>{data.people.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name||p.user_id}</option>)}</select></label></div><label>Description<textarea required minLength={3} value={draft.description||""} onChange={e=>setDraft({...draft,description:e.target.value})}/></label><div className={styles.three}><label>Likelihood<select value={draft.likelihood||"3"} onChange={e=>setDraft({...draft,likelihood:e.target.value})}>{[1,2,3,4,5].map(v=><option key={v}>{v}</option>)}</select></label><label>Impact<select value={draft.impact||"3"} onChange={e=>setDraft({...draft,impact:e.target.value})}>{[1,2,3,4,5].map(v=><option key={v}>{v}</option>)}</select></label><label>Treatment<select value={draft.treatment||"MITIGATE"} onChange={e=>setDraft({...draft,treatment:e.target.value})}>{["AVOID","MITIGATE","TRANSFER","ACCEPT"].map(v=><option key={v}>{v}</option>)}</select></label></div><div className={styles.two}><label>Department<input value={draft.department||""} onChange={e=>setDraft({...draft,department:e.target.value})}/></label><label>Review date<input type="date" value={draft.review_on||""} onChange={e=>setDraft({...draft,review_on:e.target.value})}/></label></div><label>Source reference<input value={draft.source_reference||""} onChange={e=>setDraft({...draft,source_reference:e.target.value})}/></label></>
      :modal.kind==="UPDATE_RISK"?<><div className={styles.three}><label>Likelihood<select value={draft.likelihood} onChange={e=>setDraft({...draft,likelihood:e.target.value})}>{[1,2,3,4,5].map(v=><option key={v}>{v}</option>)}</select></label><label>Impact<select value={draft.impact} onChange={e=>setDraft({...draft,impact:e.target.value})}>{[1,2,3,4,5].map(v=><option key={v}>{v}</option>)}</select></label><label>Status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{["IDENTIFIED","ASSESSING","MITIGATING","MONITORING","ACCEPTED","CLOSED"].map(v=><option key={v}>{v}</option>)}</select></label></div><div className={styles.three}><label>Treatment<select value={draft.treatment} onChange={e=>setDraft({...draft,treatment:e.target.value})}>{["AVOID","MITIGATE","TRANSFER","ACCEPT"].map(v=><option key={v}>{v}</option>)}</select></label><label>Residual likelihood<input type="number" min="1" max="5" value={draft.residual_likelihood||""} onChange={e=>setDraft({...draft,residual_likelihood:e.target.value})}/></label><label>Residual impact<input type="number" min="1" max="5" value={draft.residual_impact||""} onChange={e=>setDraft({...draft,residual_impact:e.target.value})}/></label></div><label>Review date<input type="date" value={draft.review_on||""} onChange={e=>setDraft({...draft,review_on:e.target.value})}/></label>{draft.status==="ACCEPTED"?<label>Acceptance basis<textarea required minLength={3} value={draft.acceptance_basis||""} onChange={e=>setDraft({...draft,acceptance_basis:e.target.value})}/></label>:null}{draft.status==="CLOSED"?<label>Closure evidence reference<input required minLength={3} value={draft.closure_evidence||""} onChange={e=>setDraft({...draft,closure_evidence:e.target.value})}/></label>:null}<label>Note<textarea value={draft.note||""} onChange={e=>setDraft({...draft,note:e.target.value})}/></label></>
      :modal.kind==="RISK_ACTION"?<><label>Action title<input required minLength={3} value={draft.title||""} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>Owner<select required value={draft.owner_user_id||""} onChange={e=>setDraft({...draft,owner_user_id:e.target.value})}><option value="">Select owner</option>{data.people.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name||p.user_id}</option>)}</select></label><label>Due date<input type="date" value={draft.due_on||""} onChange={e=>setDraft({...draft,due_on:e.target.value})}/></label><label>Note<textarea value={draft.note||""} onChange={e=>setDraft({...draft,note:e.target.value})}/></label></>
      :modal.kind==="ACTION_STATUS"?<><label>Status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{["OPEN","IN_PROGRESS","BLOCKED","DONE","CANCELLED"].map(v=><option key={v}>{v}</option>)}</select></label>{draft.status==="DONE"?<label>Completion evidence reference<input required minLength={3} value={draft.evidence_reference||""} onChange={e=>setDraft({...draft,evidence_reference:e.target.value})}/></label>:null}<label>Note<textarea value={draft.note||""} onChange={e=>setDraft({...draft,note:e.target.value})}/></label></>
      :modal.kind==="DECISION"?<><label>Title<input required minLength={3} value={draft.title||""} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><div className={styles.two}><label>Category<select value={draft.category||"OTHER"} onChange={e=>setDraft({...draft,category:e.target.value})}>{["STRATEGY","PRODUCT","FINANCE","PEOPLE","LEGAL","SECURITY","OPERATIONS","CUSTOMER","VENDOR","GOVERNANCE","OTHER"].map(v=><option key={v}>{v}</option>)}</select></label><label>Decision maker<select required value={draft.decision_maker_user_id||""} onChange={e=>setDraft({...draft,decision_maker_user_id:e.target.value})}><option value="">Select authorised owner/director</option>{data.people.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name||p.user_id}</option>)}</select></label></div><label>Context<textarea required minLength={3} value={draft.context||""} onChange={e=>setDraft({...draft,context:e.target.value})}/></label><label>Decision<textarea required minLength={3} value={draft.decision||""} onChange={e=>setDraft({...draft,decision:e.target.value})}/></label><div className={styles.two}><label>Decision time<input required type="datetime-local" value={draft.decision_at||""} onChange={e=>setDraft({...draft,decision_at:e.target.value})}/></label><label>Authority basis<input required minLength={3} value={draft.authority_basis||""} onChange={e=>setDraft({...draft,authority_basis:e.target.value})}/></label></div><label>Approval reference<input value={draft.approval_reference||""} onChange={e=>setDraft({...draft,approval_reference:e.target.value})}/></label><div className={styles.two}><label>Effective from<input type="date" value={draft.effective_from||""} onChange={e=>setDraft({...draft,effective_from:e.target.value})}/></label><label>Review on<input type="date" value={draft.review_on||""} onChange={e=>setDraft({...draft,review_on:e.target.value})}/></label></div><label>Supersedes<select value={draft.supersedes_decision_id||""} onChange={e=>setDraft({...draft,supersedes_decision_id:e.target.value})}><option value="">None</option>{data.decisions.filter(d=>d.status==="ACTIVE").map(d=><option key={d.id} value={d.id}>{d.decision_code} · {d.title}</option>)}</select></label>{draft.supersedes_decision_id?<label>Change reason<textarea required minLength={3} value={draft.change_reason||""} onChange={e=>setDraft({...draft,change_reason:e.target.value})}/></label>:null}<label>Source reference<input value={draft.source_reference||""} onChange={e=>setDraft({...draft,source_reference:e.target.value})}/></label></>
      :modal.kind==="REVOKE_DECISION"?<label>Revocation reason<textarea required minLength={3} value={draft.reason||""} onChange={e=>setDraft({...draft,reason:e.target.value})}/></label>
      :modal.kind==="CHANGE"?<><label>Title<input required minLength={3} value={draft.title||""} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><div className={styles.two}><label>Kind<select value={draft.kind||"PROCESS"} onChange={e=>setDraft({...draft,kind:e.target.value})}>{["ORGANISATION","POLICY","COMPENSATION","FINANCE","INFRASTRUCTURE","LEGAL","PROCESS","SECURITY","DATA","PRODUCT","CUSTOMER","VENDOR","OTHER"].map(v=><option key={v}>{v}</option>)}</select></label><label>Owner<select required value={draft.owner_user_id||""} onChange={e=>setDraft({...draft,owner_user_id:e.target.value})}><option value="">Select owner</option>{data.people.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name||p.user_id}</option>)}</select></label></div><label>Description<textarea required minLength={3} value={draft.description||""} onChange={e=>setDraft({...draft,description:e.target.value})}/></label><label>Risk summary<textarea value={draft.risk_summary||""} onChange={e=>setDraft({...draft,risk_summary:e.target.value})}/></label><label>Implementation plan<textarea required minLength={3} value={draft.implementation_plan||""} onChange={e=>setDraft({...draft,implementation_plan:e.target.value})}/></label><label>Rollback plan<textarea value={draft.rollback_plan||""} onChange={e=>setDraft({...draft,rollback_plan:e.target.value})}/></label><div className={styles.two}><label>Department<input value={draft.department||""} onChange={e=>setDraft({...draft,department:e.target.value})}/></label><label>Effective time<input type="datetime-local" value={draft.effective_at||""} onChange={e=>setDraft({...draft,effective_at:e.target.value})}/></label></div></>
      :<><label>Status<select required value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{nextChangeStates(modal.change,data.capabilities.review_change).map(v=><option key={v}>{v}</option>)}</select></label>{draft.status==="APPROVED"?<label>Approval reference<input required minLength={3} value={draft.approval_reference||""} onChange={e=>setDraft({...draft,approval_reference:e.target.value})}/></label>:null}{["VERIFIED","CLOSED"].includes(draft.status)?<label>Verification evidence reference<input required minLength={3} value={draft.verification_evidence||""} onChange={e=>setDraft({...draft,verification_evidence:e.target.value})}/></label>:null}<label>Note<textarea value={draft.note||""} onChange={e=>setDraft({...draft,note:e.target.value})}/></label></>}
      <footer><button type="button" disabled={busy} onClick={()=>setModal(undefined)}>Cancel</button><button type="submit" disabled={busy}>{busy?<LoaderCircle className={styles.spin}/>:<ShieldCheck/>}Confirm</button></footer>
    </form></div>:null}
  </section>;
}
