"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleAlert, FileCheck2, FileSearch, Fingerprint, LoaderCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import styles from "./office-financial-assurance.module.css";

type Mode="compliance"|"audit";
type ComplianceObligation={id:string;title:string;authority:string;status:string;due_date?:string|null;owner?:string|null;evidence_ref?:string|null;risk:string};
type DocumentRow={id:string;title:string;document_type:string;area:string;status:string;current_version:number;locked:boolean;sha256?:string|null;filename?:string|null};
type Inspection={id:string;authority:string;reference_no?:string|null;scope_text:string;period_start?:string|null;period_end?:string|null;status:string;requested_by?:string|null;owner?:string|null;manifest?:Record<string,unknown>};
type AuditEvent={id:string;occurred_at:string;actor:string;role:string;event_type:string;entity_type:string;entity_id:string;severity:string;previous_hash?:string|null;event_hash?:string|null;detail:Record<string,unknown>};
type ChainResult={valid:boolean;event_count:number;last_hash?:string|null;failures:Array<Record<string,unknown>>};
type Dialog={kind:"OBLIGATION"}|{kind:"INSPECTION"}|{kind:"MANIFEST";inspection:Inspection};
type Draft=Record<string,string>;

async function runtime<T>(path:string,options?:RequestInit):Promise<T>{
 const response=await fetch("/api/office-runtime/"+path,{...options,credentials:"same-origin",cache:"no-store"});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof body.detail==="string"?body.detail:"Financial assurance runtime request failed");
 return body as T;
}
function headers(){return {"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()}}
function date(value?:string|null){if(!value)return "—";const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("en-IN",{dateStyle:"medium"}).format(d)}
function dateTime(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(d)}
function shortHash(value?:string|null){return value?value.slice(0,14)+"…":"—"}
function manifestReadiness(manifest?:Record<string,unknown>){return typeof manifest?.readiness==="string"?manifest.readiness:"NOT_BUILT"}
function manifestWarnings(manifest?:Record<string,unknown>){return Array.isArray(manifest?.warnings)?manifest.warnings.length:0}

export function OfficeFinancialAssurance({
 mode,canManageCompliance,canManageInspections,canVerifyChain,
}:{mode:Mode;canManageCompliance:boolean;canManageInspections:boolean;canVerifyChain:boolean}){
 const[obligations,setObligations]=useState<ComplianceObligation[]>([]);const[inspections,setInspections]=useState<Inspection[]>([]);const[documents,setDocuments]=useState<DocumentRow[]>([]);const[auditEvents,setAuditEvents]=useState<AuditEvent[]>([]);const[chain,setChain]=useState<ChainResult>();const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);const[dialog,setDialog]=useState<Dialog>();const[draft,setDraft]=useState<Draft>({});const[selectedDocs,setSelectedDocs]=useState<string[]>([]);const[notice,setNotice]=useState<string>();const[error,setError]=useState<string>();

 const fetchRecords=useCallback(async()=>{
  const common=await Promise.all([runtime<ComplianceObligation[]>("compliance"),runtime<Inspection[]>("inspections"),runtime<DocumentRow[]>("documents")]);
  const audit=mode==="audit"?await runtime<AuditEvent[]>("audit"):[];
  return [...common,audit] as [ComplianceObligation[],Inspection[],DocumentRow[],AuditEvent[]];
 },[mode]);
 const apply=useCallback(([o,i,d,a]:[ComplianceObligation[],Inspection[],DocumentRow[],AuditEvent[]])=>{setObligations(o);setInspections(i);setDocuments(d);setAuditEvents(a)},[]);
 const load=useCallback(async()=>{setLoading(true);setError(undefined);try{apply(await fetchRecords())}catch(caught){setError(caught instanceof Error?caught.message:"Unable to load assurance records")}finally{setLoading(false)}},[apply,fetchRecords]);
 useEffect(()=>{let active=true;void fetchRecords().then(records=>{if(active)apply(records)}).catch(caught=>{if(active)setError(caught instanceof Error?caught.message:"Unable to load assurance records")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[apply,fetchRecords]);

 const lockedDocs=useMemo(()=>documents.filter(d=>d.locked&&Boolean(d.sha256)),[documents]);
 const openObligations=obligations.filter(o=>!["CLOSED","NOT_APPLICABLE"].includes(o.status));
 const highRisk=obligations.filter(o=>["HIGH","CRITICAL","URGENT"].includes(String(o.risk).toUpperCase())).length;

 async function refresh(message:string){setNotice(message);setDialog(undefined);setDraft({});setSelectedDocs([]);await load()}
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!dialog)return;setBusy(true);setError(undefined);try{
  if(dialog.kind==="OBLIGATION"){
   await runtime("compliance",{method:"POST",headers:headers(),body:JSON.stringify({title:draft.title,authority:draft.authority,status:"UNVERIFIED",due_date:draft.due_date||undefined,owner:draft.owner||undefined,evidence_ref:draft.evidence_ref||undefined,risk:draft.risk||"MEDIUM"})});
   await refresh("Compliance obligation recorded as UNVERIFIED. Professional review and evidence are still required.");
  }else if(dialog.kind==="INSPECTION"){
   await runtime("inspections",{method:"POST",headers:headers(),body:JSON.stringify({authority:draft.authority,reference_no:draft.reference_no||undefined,scope_text:draft.scope_text,period_start:draft.period_start||undefined,period_end:draft.period_end||undefined,requested_by:draft.requested_by||undefined,owner:draft.owner||undefined})});
   await refresh("Inspection workspace opened. No readiness claim is made until evidence is packaged and reviewed.");
  }else{
   if(!selectedDocs.length)throw new Error("Select at least one locked evidence document");
   await runtime("inspections/"+encodeURIComponent(dialog.inspection.id)+"/build-manifest",{method:"POST",headers:headers(),body:JSON.stringify(selectedDocs)});
   await refresh("Inspection evidence manifest generated from selected canonical document versions.");
  }
 }catch(caught){setError(caught instanceof Error?caught.message:"Assurance action failed")}finally{setBusy(false)}}

 async function verifyChain(){setBusy(true);setError(undefined);try{const result=await runtime<ChainResult>("audit/verify-chain");setChain(result);setNotice(result.valid?"Audit hash chain verified for the current canonical event set.":"Audit hash-chain verification found integrity failures requiring investigation.")}catch(caught){setError(caught instanceof Error?caught.message:"Audit chain verification failed")}finally{setBusy(false)}}

 function toggleDoc(id:string){setSelectedDocs(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id])}

 return <section className={styles.shell}>
  <header className={styles.hero}><div><p>{mode==="compliance"?"FINANCIAL COMPLIANCE":"FINANCIAL AUDIT"}</p><h2>{mode==="compliance"?"Track obligations and evidence without claiming statutory compliance automatically.":"Inspect finance evidence, audit events and tamper-evident history without rewriting source records."}</h2><span>{mode==="compliance"?"New obligations start UNVERIFIED. Filing, applicability and compliance conclusions require authoritative evidence and professional review.":"Audit manifests reference versioned documents and hashes. Chain verification checks record integrity; it is not a legal or accounting opinion."}</span></div><div className={styles.guard}><ShieldCheck/><span>Assurance boundary</span><b>Evidence before conclusions</b></div></header>
  <div className={styles.toolbar}><button type="button" disabled={loading||busy} onClick={()=>void load()}><RefreshCw/>Refresh</button>{mode==="compliance"&&canManageCompliance?<button type="button" disabled={busy} onClick={()=>{setDraft({risk:"MEDIUM"});setDialog({kind:"OBLIGATION"})}}><FileCheck2/>Add obligation</button>:null}{canManageInspections?<button type="button" disabled={busy} onClick={()=>{setDraft({});setDialog({kind:"INSPECTION"})}}><FileSearch/>Open inspection</button>:null}{mode==="audit"&&canVerifyChain?<button type="button" disabled={busy} onClick={()=>void verifyChain()}><Fingerprint/>Verify audit chain</button>:null}<Link href="/finance/documents">Finance documents</Link></div>
  {notice?<div className={styles.notice}><BadgeCheck/>{notice}</div>:null}{error?<div className={styles.error}><CircleAlert/>{error}</div>:null}
  {loading?<div className={styles.state}><LoaderCircle className={styles.spin}/>Loading canonical assurance evidence…</div>:<>
   <div className={styles.metrics}><article><span>Compliance obligations</span><b>{obligations.length}</b></article><article><span>Open obligations</span><b>{openObligations.length}</b></article><article><span>High-risk records</span><b>{highRisk}</b></article><article><span>Locked evidence docs</span><b>{lockedDocs.length}</b></article></div>
   {mode==="compliance"?<section className={styles.panel}><header className={styles.panelHead}><div><p>OBLIGATION REGISTER</p><h3>Evidence-backed finance and tax obligations</h3></div><span>Status is source data, not a system-generated compliance score.</span></header><div className={styles.cards}>{obligations.map(o=><article className={styles.card} key={o.id}><header><div><small>{o.authority} · {o.risk}</small><h4>{o.title}</h4></div><em data-status={o.status}>{o.status}</em></header><dl><div><dt>Due</dt><dd>{date(o.due_date)}</dd></div><div><dt>Owner</dt><dd>{o.owner||"—"}</dd></div><div><dt>Evidence</dt><dd>{o.evidence_ref||"Not linked"}</dd></div></dl></article>)}{!obligations.length?<div className={styles.empty}>No compliance obligations are recorded.</div>:null}</div></section>:null}
   <section className={styles.panel}><header className={styles.panelHead}><div><p>INSPECTIONS</p><h3>Evidence packages and external-review scopes</h3></div><span>Manifest readiness reflects document packaging only; it does not mean an authority accepted the submission.</span></header><div className={styles.cards}>{inspections.map(i=><article className={styles.card} key={i.id}><header><div><small>{i.authority}{i.reference_no?" · "+i.reference_no:""}</small><h4>{i.scope_text}</h4></div><em data-status={i.status}>{i.status}</em></header><dl><div><dt>Period</dt><dd>{date(i.period_start)} → {date(i.period_end)}</dd></div><div><dt>Owner</dt><dd>{i.owner||"—"}</dd></div><div><dt>Manifest</dt><dd>{manifestReadiness(i.manifest)}</dd></div><div><dt>Warnings</dt><dd>{manifestWarnings(i.manifest)}</dd></div></dl>{canManageInspections?<div className={styles.actions}><button type="button" disabled={busy||!lockedDocs.length} onClick={()=>{setSelectedDocs([]);setDialog({kind:"MANIFEST",inspection:i})}}><FileCheck2/>Build evidence manifest</button></div>:null}</article>)}{!inspections.length?<div className={styles.empty}>No inspection cases are recorded.</div>:null}</div></section>
   {mode==="audit"?<><section className={styles.chain} data-valid={chain?.valid===true} data-invalid={chain?.valid===false}><Fingerprint/><div><b>{chain?chain.valid?"Audit chain valid":"Audit chain integrity exception":"Audit chain not verified in this session"}</b><span>{chain?chain.event_count+" events checked · "+chain.failures.length+" failure(s)":"Owner, Director or Auditor can run an on-demand cryptographic chain verification."}</span></div></section><section className={styles.panel}><header className={styles.panelHead}><div><p>AUDIT EVENTS</p><h3>Latest canonical material actions</h3></div><span>Hashes are displayed as evidence references; full values remain in the canonical event record.</span></header><div className={styles.tableWrap}><table><thead><tr><th>Time</th><th>Actor</th><th>Event</th><th>Entity</th><th>Severity</th><th>Hash</th></tr></thead><tbody>{auditEvents.map(e=><tr key={e.id}><td>{dateTime(e.occurred_at)}</td><td><strong>{e.actor}</strong><span>{e.role}</span></td><td>{e.event_type}</td><td>{e.entity_type} · {e.entity_id}</td><td>{e.severity}</td><td><code title={e.event_hash||""}>{shortHash(e.event_hash)}</code></td></tr>)}{!auditEvents.length?<tr><td colSpan={6}><div className={styles.empty}>No audit events returned.</div></td></tr>:null}</tbody></table></div></section></>:null}
  </>}
  {dialog?<div className={styles.backdrop} role="presentation" onMouseDown={()=>!busy&&setDialog(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={e=>e.stopPropagation()}><header><div><small>FINANCIAL ASSURANCE</small><h3>{dialog.kind==="OBLIGATION"?"Record obligation":dialog.kind==="INSPECTION"?"Open inspection":"Build inspection manifest"}</h3></div><button type="button" aria-label="Close" disabled={busy} onClick={()=>setDialog(undefined)}><X/></button></header>
   {dialog.kind==="OBLIGATION"?<><label>Obligation title<input required minLength={2} value={draft.title||""} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><div className={styles.two}><label>Authority<input required minLength={2} value={draft.authority||""} onChange={e=>setDraft({...draft,authority:e.target.value})}/></label><label>Risk<select value={draft.risk||"MEDIUM"} onChange={e=>setDraft({...draft,risk:e.target.value})}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label></div><div className={styles.two}><label>Due date<input type="date" value={draft.due_date||""} onChange={e=>setDraft({...draft,due_date:e.target.value})}/></label><label>Owner<input value={draft.owner||""} onChange={e=>setDraft({...draft,owner:e.target.value})}/></label></div><label>Evidence reference<input value={draft.evidence_ref||""} onChange={e=>setDraft({...draft,evidence_ref:e.target.value})}/></label><p className={styles.warning}>The record will be created as UNVERIFIED. This interface never creates a “compliant” or “filed” conclusion by itself.</p></>
   :dialog.kind==="INSPECTION"?<><div className={styles.two}><label>Authority<input required minLength={2} value={draft.authority||""} onChange={e=>setDraft({...draft,authority:e.target.value})}/></label><label>Reference number<input value={draft.reference_no||""} onChange={e=>setDraft({...draft,reference_no:e.target.value})}/></label></div><label>Scope<textarea required minLength={3} value={draft.scope_text||""} onChange={e=>setDraft({...draft,scope_text:e.target.value})}/></label><div className={styles.two}><label>Period start<input type="date" value={draft.period_start||""} onChange={e=>setDraft({...draft,period_start:e.target.value})}/></label><label>Period end<input type="date" value={draft.period_end||""} onChange={e=>setDraft({...draft,period_end:e.target.value})}/></label></div><div className={styles.two}><label>Requested by<input value={draft.requested_by||""} onChange={e=>setDraft({...draft,requested_by:e.target.value})}/></label><label>Owner<input value={draft.owner||""} onChange={e=>setDraft({...draft,owner:e.target.value})}/></label></div><p className={styles.warning}>Opening an inspection creates a controlled review case only; it does not represent an authority notice or successful audit outcome unless the source evidence says so.</p></>
   :<><p>Select locked canonical evidence for <b>{dialog.inspection.scope_text}</b>.</p><div className={styles.docList}>{lockedDocs.map(doc=><label key={doc.id}><input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={()=>toggleDoc(doc.id)}/><span><b>{doc.title}</b><small>{doc.document_type} · v{doc.current_version} · {shortHash(doc.sha256)}</small></span></label>)}{!lockedDocs.length?<div className={styles.empty}>No locked documents with hashes are available.</div>:null}</div><p className={styles.warning}>The generated manifest records versions, SHA-256 hashes and warnings. “READY” means packaged evidence has no manifest warnings, not that an external reviewer accepted it.</p></>}
   <footer><button type="button" disabled={busy} onClick={()=>setDialog(undefined)}>Cancel</button><button type="submit" disabled={busy}>{busy?<LoaderCircle className={styles.spin}/>:<BadgeCheck/>}Confirm</button></footer></form></div>:null}
 </section>
}
