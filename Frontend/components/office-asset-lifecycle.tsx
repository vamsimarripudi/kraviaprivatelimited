"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleAlert, Laptop2, LoaderCircle, Plus, RefreshCw, ShieldCheck, Wrench, X } from "lucide-react";
import styles from "./office-asset-lifecycle.module.css";

type Caps={read_company:boolean;read_own:boolean;manage:boolean;wipe:boolean;dispose:boolean};
type Asset={id:string;asset_no:string;name:string;category:string;serial_no?:string|null;assigned_employee_id?:string|null;location?:string|null;purchase_paise?:number|null;status:string;created_at:string};
type Life={asset_id:string;device_id?:string|null;custodian_user_id?:string|null;supplier_name?:string|null;warranty_expires_on?:string|null;condition:string;lifecycle_status:string;security_wipe_required:boolean;wipe_evidence_reference?:string|null;wipe_verified_by?:string|null;wipe_verified_at?:string|null;maintenance_due_on?:string|null;disposal_evidence_reference?:string|null;disposal_approved_by?:string|null;disposal_approved_at?:string|null;updated_by:string;created_at:string;updated_at:string};
type Event={id:number;event_code:string;asset_id:string;actor_user_id:string;event_type:string;previous_status?:string|null;new_status?:string|null;evidence_reference?:string|null;note?:string|null;created_at:string};
type Person={user_id:string;display_name?:string|null;job_title?:string|null};
type Device={id:string;user_id?:string|null;device_label:string;device_kind:string;platform:string;trust_state:string;company_managed:boolean};
type Payload={actor:{user_id:string;roles:string[]};capabilities:Caps;assets:Asset[];lifecycle:Life[];events:Event[];people:Person[];devices:Device[];disclaimer:string};
type Modal=
 |{kind:"REGISTER";asset:Asset}
 |{kind:"ASSIGN";asset:Asset;life:Life}
 |{kind:"TRANSITION";asset:Asset;life:Life;action:string}
 |{kind:"WIPE";asset:Asset;life:Life}
 |{kind:"DISPOSE";asset:Asset;life:Life};

async function api<T>(options?:RequestInit):Promise<T>{
 const response=await fetch("/api/office-assets",{...options,cache:"no-store",credentials:"same-origin"});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof body.detail==="string"?body.detail:"Asset lifecycle request failed");
 return body as T;
}
function date(value?:string|null){if(!value)return "—";const d=new Date(value.length===10?value+"T00:00:00":value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("en-IN",{dateStyle:"medium"}).format(d)}
function money(value?:number|null){return value==null?"—":"₹"+(value/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
function nextActions(life:Life){
 if(life.lifecycle_status==="ASSIGNED")return ["REQUEST_RETURN","RETURN","SEND_REPAIR","LOST"];
 if(life.lifecycle_status==="RETURN_PENDING")return ["RETURN","LOST"];
 if(["IN_STOCK","READY_FOR_REISSUE"].includes(life.lifecycle_status))return ["SEND_REPAIR","REQUEST_DISPOSAL","LOST"];
 if(life.lifecycle_status==="REPAIR")return ["RETURN_REPAIR","LOST"];
 if(life.lifecycle_status==="WIPE_PENDING")return ["REQUEST_DISPOSAL"];
 return [];
}

export function OfficeAssetLifecycle(){
 const[data,setData]=useState<Payload>();const[modal,setModal]=useState<Modal>();const[draft,setDraft]=useState<Record<string,string>>({});const[busy,setBusy]=useState(false);const[error,setError]=useState<string>();const[notice,setNotice]=useState<string>();
 async function reload(message?:string){const next=await api<Payload>();setData(next);if(message)setNotice(message)}
 useEffect(()=>{let alive=true;void api<Payload>().then(next=>{if(alive)setData(next)}).catch((caught:unknown)=>{if(alive)setError(caught instanceof Error?caught.message:"Unable to load assets")});return()=>{alive=false}},[]);
 const lifeMap=useMemo(()=>new Map((data?.lifecycle??[]).map(row=>[row.asset_id,row])),[data?.lifecycle]);
 const people=useMemo(()=>new Map((data?.people??[]).map(row=>[row.user_id,row])),[data?.people]);
 const devices=useMemo(()=>new Map((data?.devices??[]).map(row=>[row.id,row])),[data?.devices]);
 const events=useMemo(()=>{const map=new Map<string,Event[]>();for(const row of data?.events??[]){const list=map.get(row.asset_id)||[];list.push(row);map.set(row.asset_id,list)}return map},[data?.events]);

 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!modal)return;setBusy(true);setError(undefined);try{
  if(modal.kind==="REGISTER")await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"REGISTER",asset_id:modal.asset.id,device_id:draft.device_id||undefined,supplier:draft.supplier||undefined,warranty_expires_on:draft.warranty||undefined,condition:draft.condition||"GOOD",security_wipe_required:draft.wipe_required==="YES",maintenance_due_on:draft.maintenance_due||undefined})});
  else if(modal.kind==="ASSIGN")await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"ASSIGN",asset_id:modal.asset.id,user_id:draft.user_id,location:draft.location||undefined,note:draft.note||undefined})});
  else if(modal.kind==="TRANSITION")await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"TRANSITION",asset_id:modal.asset.id,lifecycle_action:modal.action,condition:draft.condition||undefined,evidence:draft.evidence||undefined,note:draft.note||undefined})});
  else if(modal.kind==="WIPE")await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"VERIFY_WIPE",asset_id:modal.asset.id,evidence:draft.evidence,note:draft.note||undefined})});
  else await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"DISPOSE",asset_id:modal.asset.id,evidence:draft.evidence,note:draft.note||undefined})});
  await reload("Asset lifecycle updated.");setModal(undefined);setDraft({});
 }catch(caught){setError(caught instanceof Error?caught.message:"Asset action failed")}finally{setBusy(false)}}

 if(error&&!data)return <section className={styles.state}><CircleAlert/><div><h2>Asset lifecycle unavailable</h2><p>{error}</p></div></section>;
 if(!data)return <section className={styles.state}><LoaderCircle className={styles.spin}/><div><h2>Loading company assets</h2></div></section>;
 const assigned=data.lifecycle.filter(l=>l.lifecycle_status==="ASSIGNED").length;
 const service=data.lifecycle.filter(l=>["REPAIR","WIPE_PENDING","DISPOSAL_PENDING"].includes(l.lifecycle_status)).length;
 const available=data.lifecycle.filter(l=>["IN_STOCK","READY_FOR_REISSUE"].includes(l.lifecycle_status)).length;

 return <section className={styles.shell}>
  <header className={styles.hero}><div><p>ASSET LIFECYCLE · DEVICES · CUSTODY</p><h2>Track company equipment from inventory through secure return and disposal.</h2><span>{data.disclaimer}</span></div><div className={styles.metrics}><article><b>{assigned}</b><span>assigned</span></article><article><b>{available}</b><span>available/reissue</span></article><article><b>{service}</b><span>repair/wipe/disposal</span></article></div></header>
  <div className={styles.toolbar}><button type="button" onClick={()=>void reload()}><RefreshCw/>Refresh</button></div>
  {notice?<div className={styles.notice}><BadgeCheck/>{notice}</div>:null}{error?<div className={styles.error}><CircleAlert/>{error}</div>:null}

  <div className={styles.grid}>{data.assets.map(asset=>{const life=lifeMap.get(asset.id);const history=events.get(asset.id)||[];return <article className={styles.card} key={asset.id}><header><div><small>{asset.asset_no} · {asset.category}</small><h3>{asset.name}</h3><span>{asset.serial_no||"No serial"} · {asset.location||"No location"}</span></div><em className={styles.badge} data-status={life?.lifecycle_status||asset.status}>{(life?.lifecycle_status||asset.status).replaceAll("_"," ")}</em></header><div className={styles.kv}><span>Condition<b>{life?.condition||"Not registered"}</b></span><span>Custodian<b>{life?.custodian_user_id?people.get(life.custodian_user_id)?.display_name||"Assigned":asset.assigned_employee_id||"—"}</b></span><span>Device link<b>{life?.device_id?devices.get(life.device_id)?.device_label||life.device_id:"—"}</b></span><span>Warranty<b>{date(life?.warranty_expires_on)}</b></span><span>Maintenance due<b>{date(life?.maintenance_due_on)}</b></span><span>Purchase value<b>{money(asset.purchase_paise)}</b></span></div>{life?.wipe_evidence_reference?<p><b>Wipe evidence:</b> {life.wipe_evidence_reference}</p>:null}{life?.disposal_evidence_reference?<p><b>Disposal evidence:</b> {life.disposal_evidence_reference}</p>:null}<div className={styles.actions}>{!life&&data.capabilities.manage?<button type="button" onClick={()=>{setDraft({condition:"GOOD",wipe_required:"NO"});setModal({kind:"REGISTER",asset})}}><Plus/>Register lifecycle</button>:null}{life&&data.capabilities.manage&&["IN_STOCK","READY_FOR_REISSUE"].includes(life.lifecycle_status)?<button type="button" onClick={()=>{setDraft({});setModal({kind:"ASSIGN",asset,life})}}>Assign</button>:null}{life&&data.capabilities.manage?nextActions(life).map(action=><button type="button" key={action} onClick={()=>{setDraft({condition:life.condition});setModal({kind:"TRANSITION",asset,life,action})}}>{action.replaceAll("_"," ")}</button>):null}{life&&data.capabilities.wipe&&["WIPE_PENDING","DISPOSAL_PENDING"].includes(life.lifecycle_status)&&!life.wipe_evidence_reference?<button type="button" onClick={()=>{setDraft({evidence:""});setModal({kind:"WIPE",asset,life})}}><ShieldCheck/>Verify wipe</button>:null}{life&&data.capabilities.dispose&&life.lifecycle_status==="DISPOSAL_PENDING"?<button type="button" onClick={()=>{setDraft({evidence:""});setModal({kind:"DISPOSE",asset,life})}}>Approve disposal</button>:null}</div>{history.length?<details><summary>Lifecycle history</summary><div className={styles.history}>{history.slice(0,12).map(ev=><div key={ev.id}><Wrench/><span><b>{ev.event_type.replaceAll("_"," ")}</b>{date(ev.created_at)}{ev.evidence_reference?<small>Evidence: {ev.evidence_reference}</small>:null}</span></div>)}</div></details>:null}</article>})}{!data.assets.length?<div className={styles.empty}>No assets are visible in your authorised scope.</div>:null}</div>

  {modal?<div className={styles.backdrop} role="presentation" onMouseDown={()=>!busy&&setModal(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={e=>e.stopPropagation()}><header><div><small>CONTROLLED ASSET ACTION</small><h3>{modal.kind.replaceAll("_"," ")}</h3></div><button type="button" aria-label="Close" onClick={()=>setModal(undefined)}><X/></button></header>
   {modal.kind==="REGISTER"?<><p><Laptop2/> {modal.asset.asset_no} · {modal.asset.name}</p><label>Linked company device<select value={draft.device_id||""} onChange={e=>setDraft({...draft,device_id:e.target.value})}><option value="">No device registry link</option>{data.devices.map(d=><option key={d.id} value={d.id}>{d.device_label} · {d.platform} · {d.trust_state}</option>)}</select></label><div className={styles.two}><label>Supplier<input value={draft.supplier||""} onChange={e=>setDraft({...draft,supplier:e.target.value})}/></label><label>Condition<select value={draft.condition||"GOOD"} onChange={e=>setDraft({...draft,condition:e.target.value})}>{["NEW","GOOD","FAIR","DAMAGED","LOST"].map(v=><option key={v}>{v}</option>)}</select></label></div><div className={styles.two}><label>Warranty expiry<input type="date" value={draft.warranty||""} onChange={e=>setDraft({...draft,warranty:e.target.value})}/></label><label>Maintenance due<input type="date" value={draft.maintenance_due||""} onChange={e=>setDraft({...draft,maintenance_due:e.target.value})}/></label></div><label>Secure wipe required before reissue/disposal<select value={draft.wipe_required||"NO"} onChange={e=>setDraft({...draft,wipe_required:e.target.value})}><option>NO</option><option>YES</option></select></label></>
   :modal.kind==="ASSIGN"?<><label>Employee<select required value={draft.user_id||""} onChange={e=>setDraft({...draft,user_id:e.target.value})}><option value="">Select active employee</option>{data.people.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name||p.user_id}</option>)}</select></label><label>Location<input value={draft.location||""} onChange={e=>setDraft({...draft,location:e.target.value})}/></label><label>Assignment note<textarea value={draft.note||""} onChange={e=>setDraft({...draft,note:e.target.value})}/></label></>
   :modal.kind==="TRANSITION"?<><p>Action: <b>{modal.action.replaceAll("_"," ")}</b></p><label>Condition<select value={draft.condition||modal.life.condition} onChange={e=>setDraft({...draft,condition:e.target.value})}>{["NEW","GOOD","FAIR","DAMAGED","LOST"].map(v=><option key={v}>{v}</option>)}</select></label><label>Evidence reference<input value={draft.evidence||""} onChange={e=>setDraft({...draft,evidence:e.target.value})}/></label><label>Note<textarea value={draft.note||""} onChange={e=>setDraft({...draft,note:e.target.value})}/></label></>
   :modal.kind==="WIPE"?<><p>Record independent secure-wipe verification for <b>{modal.asset.asset_no}</b>. KRAVIA stores the evidence reference, not wipe credentials.</p><label>Wipe evidence reference<input required minLength={3} value={draft.evidence||""} onChange={e=>setDraft({...draft,evidence:e.target.value})}/></label><label>Note<textarea value={draft.note||""} onChange={e=>setDraft({...draft,note:e.target.value})}/></label></>
   :<><p>Approve disposal of <b>{modal.asset.asset_no}</b>. If secure wipe is required, verified wipe evidence must already exist.</p><label>Disposal evidence reference<input required minLength={3} value={draft.evidence||""} onChange={e=>setDraft({...draft,evidence:e.target.value})}/></label><label>Note<textarea value={draft.note||""} onChange={e=>setDraft({...draft,note:e.target.value})}/></label></>}
   <footer><button type="button" disabled={busy} onClick={()=>setModal(undefined)}>Cancel</button><button type="submit" disabled={busy}>{busy?<LoaderCircle className={styles.spin}/>:<ShieldCheck/>}Confirm</button></footer>
  </form></div>:null}
 </section>;
}
