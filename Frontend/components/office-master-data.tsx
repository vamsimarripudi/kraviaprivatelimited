"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BadgeCheck, Building2, CircleAlert, LoaderCircle, PackagePlus, Plus, RefreshCw, X } from "lucide-react";
import styles from "./office-master-data.module.css";

type Kind="products"|"customers";
type Product={id:string;code:string;name:string;category:string;status:string};
type Customer={id:string;legal_name:string;display_name:string;gstin?:string|null;state:string;state_code:string;country:string;status:string};
type Row=Product|Customer;

async function request<T>(kind:Kind,options?:RequestInit):Promise<T>{
 const response=await fetch("/api/office-runtime/"+kind,{...options,credentials:"same-origin",cache:"no-store"});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof body.detail==="string"?body.detail:"Canonical master-data request failed");
 return body as T;
}
function isProduct(row:Row):row is Product{return "code" in row}
function idempotencyKey(){return typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():"kravia-"+String(Date.now())+"-"+Math.random().toString(16).slice(2)}

export function OfficeMasterData({kind,canCreate}:{kind:Kind;canCreate:boolean}){
 const[data,setData]=useState<Row[]>([]);const[loading,setLoading]=useState(true);const[dialog,setDialog]=useState(false);const[draft,setDraft]=useState<Record<string,string>>({});const[busy,setBusy]=useState(false);const[error,setError]=useState<string>();const[notice,setNotice]=useState<string>();
 const fetchRecords=useCallback(()=>request<Row[]>(kind),[kind]);
 const load=useCallback(async()=>{setLoading(true);setError(undefined);try{setData(await fetchRecords())}catch(caught){setError(caught instanceof Error?caught.message:"Unable to load canonical records")}finally{setLoading(false)}},[fetchRecords]);
 useEffect(()=>{let active=true;void fetchRecords().then(rows=>{if(active)setData(rows)}).catch(caught=>{if(active)setError(caught instanceof Error?caught.message:"Unable to load canonical records")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[fetchRecords]);

 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError(undefined);try{
  const payload=kind==="products"
   ?{code:(draft.code||"").trim().toUpperCase(),name:(draft.name||"").trim(),category:(draft.category||"").trim()}
   :{legal_name:(draft.legal_name||"").trim(),display_name:(draft.display_name||"").trim()||undefined,gstin:(draft.gstin||"").trim().toUpperCase()||undefined,state:(draft.state||"").trim(),state_code:(draft.state_code||"").trim(),country:(draft.country||"India").trim(),email:(draft.email||"").trim()||undefined,phone:(draft.phone||"").trim()||undefined,billing_address:(draft.billing_address||"").trim()||undefined};
  await request(kind,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":idempotencyKey()},body:JSON.stringify(payload)});
  setDialog(false);setDraft({});setNotice(kind==="products"?"Canonical product created.":"Canonical customer created.");await load();
 }catch(caught){setError(caught instanceof Error?caught.message:"Unable to create canonical record")}finally{setBusy(false)}}

 return <section className={styles.shell}>
  <header className={styles.hero}><div><p>CANONICAL MASTER DATA</p><h2>{kind==="products"?"Products":"Customers"}</h2><span>{kind==="products"?"Product creation is finally enforced by the FastAPI runtime; the Office capability layer only decides whether to expose the action.":"Customer identities feed billing, tax, contracts and commercial workflows. Creation remains final-authority checked by the FastAPI runtime."}</span></div><div className={styles.toolbar}><button type="button" onClick={()=>void load()}><RefreshCw/>Refresh</button>{canCreate?<button type="button" onClick={()=>{setDraft(kind==="customers"?{country:"India"}:{});setDialog(true)}}><Plus/>{kind==="products"?"Create product":"Create customer"}</button>:null}</div></header>
  {notice?<div className={styles.notice}><BadgeCheck/>{notice}</div>:null}{error?<div className={styles.error}><CircleAlert/>{error}</div>:null}
  {loading?<div className={styles.state}><LoaderCircle className={styles.spin}/>Loading canonical records…</div>:<div className={styles.grid}>{data.map(row=>isProduct(row)
   ?<article className={styles.card} key={row.id}><PackagePlus/><div><small>{row.code}</small><h3>{row.name}</h3><p>{row.category}</p></div><em data-status={row.status}>{row.status}</em></article>
   :<article className={styles.card} key={row.id}><Building2/><div><small>{row.id}</small><h3>{row.display_name||row.legal_name}</h3><p>{row.legal_name} · {row.state}, {row.country}{row.gstin?" · GSTIN "+row.gstin:""}</p></div><em data-status={row.status}>{row.status}</em></article>)}
   {!data.length?<div className={styles.empty}>No canonical {kind} records yet.</div>:null}</div>}

  {dialog?<div className={styles.backdrop} role="presentation" onMouseDown={()=>!busy&&setDialog(false)}><form className={styles.dialog} onSubmit={submit} onMouseDown={e=>e.stopPropagation()}><header><div><small>CANONICAL CREATE</small><h3>{kind==="products"?"Create product":"Create customer"}</h3></div><button type="button" aria-label="Close" onClick={()=>setDialog(false)}><X/></button></header>
   {kind==="products"?<><label>Product code<input required pattern="[A-Z0-9]{2,5}" maxLength={5} value={draft.code||""} onChange={e=>setDraft({...draft,code:e.target.value.toUpperCase()})}/><small>2–5 uppercase letters/numbers.</small></label><label>Name<input required minLength={2} maxLength={120} value={draft.name||""} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Category<input required minLength={2} maxLength={120} value={draft.category||""} onChange={e=>setDraft({...draft,category:e.target.value})}/></label></>
   :<><label>Legal name<input required minLength={2} maxLength={200} value={draft.legal_name||""} onChange={e=>setDraft({...draft,legal_name:e.target.value})}/></label><label>Display name<input value={draft.display_name||""} onChange={e=>setDraft({...draft,display_name:e.target.value})}/></label><div className={styles.two}><label>State<input required minLength={2} maxLength={100} value={draft.state||""} onChange={e=>setDraft({...draft,state:e.target.value})}/></label><label>State code<input required pattern="[0-9]{2}" maxLength={2} value={draft.state_code||""} onChange={e=>setDraft({...draft,state_code:e.target.value.replace(/\D/g,"").slice(0,2)})}/></label></div><div className={styles.two}><label>Country<input required value={draft.country||"India"} onChange={e=>setDraft({...draft,country:e.target.value})}/></label><label>GSTIN<input minLength={15} maxLength={15} value={draft.gstin||""} onChange={e=>setDraft({...draft,gstin:e.target.value.toUpperCase()})}/></label></div><div className={styles.two}><label>Email<input type="email" value={draft.email||""} onChange={e=>setDraft({...draft,email:e.target.value})}/></label><label>Phone<input value={draft.phone||""} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label></div><label>Billing address<textarea value={draft.billing_address||""} onChange={e=>setDraft({...draft,billing_address:e.target.value})}/></label></>}
   <footer><button type="button" disabled={busy} onClick={()=>setDialog(false)}>Cancel</button><button type="submit" disabled={busy}>{busy?<LoaderCircle className={styles.spin}/>:<BadgeCheck/>}Create</button></footer>
  </form></div>:null}
 </section>
}
