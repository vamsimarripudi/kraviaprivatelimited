"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleAlert, Fingerprint, LoaderCircle, RefreshCw, Search, ShieldCheck } from "lucide-react";
import styles from "./office-audit-explorer.module.css";

type Person={user_id:string;display_name?:string|null;job_title?:string|null;primary_department?:string|null};
type OfficeEvent={id:number|string;actor_id?:string|null;action:string;entity_type:string;entity_id?:string|null;context:Record<string,unknown>;previous_state?:Record<string,unknown>|null;new_state?:Record<string,unknown>|null;created_at:string};
type OfficePayload={generated_at:string;actor:{user_id:string};events:OfficeEvent[];people:Person[];disclaimer:string};
type RuntimeEvent={id:string;occurred_at:string;actor:string;role:string;event_type:string;entity_type:string;entity_id:string;severity:string;previous_hash?:string|null;event_hash?:string|null;detail:Record<string,unknown>};
type Chain={valid:boolean;event_count:number;last_hash?:string|null;failures:Array<Record<string,unknown>>};
type AuditRow={id:string;source:"OFFICE"|"RUNTIME";occurred_at:string;actor:string;role:string;action:string;entity:string;severity:string;hash?:string|null;detail:Record<string,unknown>};

async function json<T>(url:string):Promise<T>{
 const response=await fetch(url,{cache:"no-store",credentials:"same-origin"});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof body.detail==="string"?body.detail:"Audit request failed");
 return body as T;
}
function dateTime(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(d)}
function preview(value:Record<string,unknown>){try{const text=JSON.stringify(value);return text.length>180?text.slice(0,177)+"…":text}catch{return "{}"}}
function shortHash(value?:string|null){return value?value.slice(0,16)+"…":"—"}

export function OfficeAuditExplorer(){
 const[office,setOffice]=useState<OfficePayload>();const[runtime,setRuntime]=useState<RuntimeEvent[]>([]);const[chain,setChain]=useState<Chain>();const[error,setError]=useState<string>();const[notice,setNotice]=useState<string>();const[busy,setBusy]=useState(false);const[query,setQuery]=useState("");const[source,setSource]=useState<"ALL"|"OFFICE"|"RUNTIME">("ALL");
 async function load(){setError(undefined);const[o,r]=await Promise.all([json<OfficePayload>("/api/office-audit-explorer"),json<RuntimeEvent[]>("/api/office-runtime/audit")]);setOffice(o);setRuntime(r)}
 useEffect(()=>{let active=true;void Promise.all([json<OfficePayload>("/api/office-audit-explorer"),json<RuntimeEvent[]>("/api/office-runtime/audit")]).then(([o,r])=>{if(active){setOffice(o);setRuntime(r)}}).catch(caught=>{if(active)setError(caught instanceof Error?caught.message:"Unable to load audit trail")});return()=>{active=false}},[]);
 const people=useMemo(()=>new Map((office?.people??[]).map(p=>[p.user_id,p])),[office?.people]);
 const rows=useMemo<AuditRow[]>(()=>{
  const a:AuditRow[]=(office?.events??[]).map(e=>({id:"office:"+String(e.id),source:"OFFICE",occurred_at:e.created_at,actor:e.actor_id?(people.get(e.actor_id)?.display_name||people.get(e.actor_id)?.job_title||e.actor_id):"System",role:people.get(e.actor_id||"")?.primary_department||"OFFICE",action:e.action,entity:e.entity_type+(e.entity_id?" · "+e.entity_id:""),severity:"CONTROL",detail:e.context||{}}));
  const b:AuditRow[]=runtime.map(e=>({id:"runtime:"+e.id,source:"RUNTIME",occurred_at:e.occurred_at,actor:e.actor,role:e.role,action:e.event_type,entity:e.entity_type+" · "+e.entity_id,severity:e.severity,hash:e.event_hash,detail:e.detail||{}}));
  return [...a,...b].sort((x,y)=>Date.parse(y.occurred_at)-Date.parse(x.occurred_at));
 },[office?.events,people,runtime]);
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return rows.filter(r=>(source==="ALL"||r.source===source)&&(!q||[r.actor,r.role,r.action,r.entity,r.severity,preview(r.detail)].join(" ").toLowerCase().includes(q))).slice(0,500)},[rows,query,source]);
 async function verify(){setBusy(true);setError(undefined);try{const result=await json<Chain>("/api/office-runtime/audit/verify-chain");setChain(result);setNotice(result.valid?"Runtime audit hash-chain verification passed.":"Runtime audit hash-chain verification found integrity failures.")}catch(caught){setError(caught instanceof Error?caught.message:"Audit-chain verification failed")}finally{setBusy(false)}}
 if(error&&!office)return <section className={styles.state}><CircleAlert/><div><h2>Audit trail unavailable</h2><p>{error}</p></div></section>;
 if(!office)return <section className={styles.state}><LoaderCircle className={styles.spin}/><div><h2>Loading corporate audit trail</h2><p>Combining Office control-plane and canonical runtime evidence.</p></div></section>;
 return <section className={styles.shell}>
  <header className={styles.hero}><div><p>CORPORATE AUDIT TRAIL</p><h2>Trace authorized Office activity, access/registration evidence, and the canonical runtime audit stream.</h2><span>{office.disclaimer}</span></div><div className={styles.heroActions}><button type="button" disabled={busy} onClick={()=>void load()}><RefreshCw/>Refresh</button><button type="button" disabled={busy} onClick={()=>void verify()}><Fingerprint/>Verify runtime chain</button></div></header>
  <div className={styles.metrics}><article><b>{rows.length}</b><span>events loaded</span></article><article><b>{office.events.length}</b><span>Office events</span></article><article><b>{runtime.length}</b><span>runtime events</span></article><article><b>{chain?chain.valid?"VALID":"EXCEPTION":"NOT RUN"}</b><span>runtime hash chain</span></article></div>
  {notice?<div className={styles.notice}><BadgeCheck/>{notice}</div>:null}{error?<div className={styles.error}><CircleAlert/>{error}</div>:null}
  {chain?<div className={styles.chain} data-valid={chain.valid}><ShieldCheck/><div><b>{chain.valid?"Runtime chain verified":"Runtime integrity exception"}</b><span>{chain.event_count} runtime events checked · {chain.failures.length} failure(s). Office control-plane events are a separate append-oriented source and are not claimed to be part of this cryptographic chain.</span></div></div>:null}
  <div className={styles.filters}><label><Search/>Search<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Actor, action, entity, severity…"/></label><label>Source<select value={source} onChange={e=>setSource(e.target.value as "ALL"|"OFFICE"|"RUNTIME")}><option>ALL</option><option>OFFICE</option><option>RUNTIME</option></select></label></div>
  <div className={styles.tableWrap}><table><thead><tr><th>Time</th><th>Source</th><th>Actor</th><th>Action</th><th>Entity</th><th>Severity</th><th>Evidence</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id}><td>{dateTime(row.occurred_at)}</td><td><em data-source={row.source}>{row.source}</em></td><td><strong>{row.actor}</strong><span>{row.role}</span></td><td>{row.action}</td><td>{row.entity}</td><td>{row.severity}</td><td><code title={row.hash||preview(row.detail)}>{row.hash?shortHash(row.hash):preview(row.detail)}</code></td></tr>)}{!filtered.length?<tr><td colSpan={7}><div className={styles.empty}>No audit events match the current filter.</div></td></tr>:null}</tbody></table></div>
 </section>
}
