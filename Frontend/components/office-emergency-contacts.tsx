"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleAlert, Eye, HeartHandshake, LoaderCircle, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import styles from "./office-emergency-contacts.module.css";

type Caps={own:boolean;safety_read:boolean};
type Contact={id:string;user_id:string;priority:number;full_name:string;relationship:string;phone_e164?:string|null;email?:string|null;notes?:string|null;active:boolean;confirmed_at:string;updated_at:string;restricted_contact?:boolean};
type Person={user_id:string;display_name?:string|null;job_title?:string|null;primary_department?:string|null};
type Payload={actor:{user_id:string;roles:string[]};capabilities:Caps;own_contacts:Contact[];safety_directory:Contact[];people:Person[];disclaimer:string};
type Modal={kind:"EDIT";contact?:Contact}|{kind:"DEACTIVATE";contact:Contact};
type Revealed={contact:Contact};

async function api<T>(options?:RequestInit):Promise<T>{
 const r=await fetch("/api/office-emergency-contacts",{...options,cache:"no-store",credentials:"same-origin"});
 const b=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(typeof b.detail==="string"?b.detail:"Emergency-contact operation failed");
 return b as T;
}
function date(v?:string|null){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(d)}

export function OfficeEmergencyContacts(){
 const[data,setData]=useState<Payload>();const[view,setView]=useState<"mine"|"safety">("mine");const[modal,setModal]=useState<Modal>();const[draft,setDraft]=useState<Record<string,string>>({});const[revealed,setRevealed]=useState<Record<string,Contact>>({});const[busy,setBusy]=useState(false);const[error,setError]=useState<string>();const[notice,setNotice]=useState<string>();
 async function reload(message?:string){const next=await api<Payload>();setData(next);setRevealed({});if(message)setNotice(message)}
 useEffect(()=>{let alive=true;void api<Payload>().then(n=>{if(alive)setData(n)}).catch((e:unknown)=>{if(alive)setError(e instanceof Error?e.message:"Unable to load emergency contacts")});return()=>{alive=false}},[]);
 const people=useMemo(()=>new Map((data?.people??[]).map(p=>[p.user_id,p])),[data?.people]);

 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!modal)return;setBusy(true);setError(undefined);try{
  if(modal.kind==="EDIT")await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"UPSERT",contact_id:modal.contact?.id,priority:Number(draft.priority||1),name:draft.name,relationship:draft.relationship,phone:draft.phone,email:draft.email||undefined,notes:draft.notes||undefined,attest:true})});
  else await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"DEACTIVATE",contact_id:modal.contact.id,reason:draft.reason})});
  await reload("Emergency-contact record updated.");setModal(undefined);setDraft({});
 }catch(caught){setError(caught instanceof Error?caught.message:"Emergency-contact action failed")}finally{setBusy(false)}}
 async function reveal(contact:Contact){
  setBusy(true);setError(undefined);
  try{const result=await api<Revealed>({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"REVEAL",contact_id:contact.id})});setRevealed(current=>({...current,[contact.id]:result.contact}))}
  catch(caught){setError(caught instanceof Error?caught.message:"Unable to reveal emergency contact")}
  finally{setBusy(false)}
 }
 async function confirm(contact:Contact){
  setBusy(true);setError(undefined);
  try{await api({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"CONFIRM",contact_id:contact.id})});await reload("Emergency contact reconfirmed.")}
  catch(caught){setError(caught instanceof Error?caught.message:"Unable to confirm emergency contact")}
  finally{setBusy(false)}
 }

 if(error&&!data)return <section className={styles.state}><CircleAlert/><div><h2>Emergency contacts unavailable</h2><p>{error}</p></div></section>;
 if(!data)return <section className={styles.state}><LoaderCircle className={styles.spin}/><div><h2>Loading emergency contacts</h2></div></section>;

 return <section className={styles.shell}>
  <header className={styles.hero}><div><p>PRIVATE SAFETY CONTACTS</p><h2>Keep emergency contacts available without putting them in the company directory.</h2><span>{data.disclaimer}</span></div><div className={styles.metrics}><article><b>{data.own_contacts.length}</b><span>your active contacts</span></article>{data.capabilities.safety_read?<article><b>{new Set(data.safety_directory.map(c=>c.user_id)).size}</b><span>employees with contacts</span></article>:null}</div></header>
  <div className={styles.toolbar}><button type="button" data-active={view==="mine"} onClick={()=>setView("mine")}>My contacts</button>{data.capabilities.safety_read?<button type="button" data-active={view==="safety"} onClick={()=>setView("safety")}>Safety directory</button>:null}<button type="button" onClick={()=>void reload()}><RefreshCw/>Refresh</button>{view==="mine"&&data.capabilities.own&&data.own_contacts.length<3?<button type="button" onClick={()=>{setDraft({priority:String(data.own_contacts.length+1)});setModal({kind:"EDIT"})}}><Plus/>Add contact</button>:null}</div>
  {notice?<div className={styles.notice}><BadgeCheck/>{notice}</div>:null}{error?<div className={styles.error}><CircleAlert/>{error}</div>:null}

  {view==="mine"?<div className={styles.grid}>{data.own_contacts.map(contact=><article className={styles.card} key={contact.id}><header><div><small>Priority {contact.priority}</small><h3>{contact.full_name}</h3><span>{contact.relationship}</span></div><HeartHandshake/></header><div className={styles.kv}><span>Phone<b>{contact.phone_e164||"—"}</b></span><span>Email<b>{contact.email||"—"}</b></span><span>Confirmed<b>{date(contact.confirmed_at)}</b></span><span>Notes<b>{contact.notes||"—"}</b></span></div><div className={styles.actions}><button type="button" onClick={()=>{setDraft({priority:String(contact.priority),name:contact.full_name,relationship:contact.relationship,phone:contact.phone_e164||"",email:contact.email||"",notes:contact.notes||""});setModal({kind:"EDIT",contact})}}>Edit & attest</button><button type="button" onClick={()=>void confirm(contact)} disabled={busy}><ShieldCheck/>Reconfirm</button><button type="button" onClick={()=>{setDraft({reason:""});setModal({kind:"DEACTIVATE",contact})}}>Deactivate</button></div></article>)}{!data.own_contacts.length?<div className={styles.empty}>No emergency contact is recorded. Add at least one current contact for safety use.</div>:null}</div>:null}

  {view==="safety"&&data.capabilities.safety_read?<div className={styles.grid}>{data.safety_directory.map(contact=>{const person=people.get(contact.user_id);const detail=revealed[contact.id];return <article className={styles.card} key={contact.id}><header><div><small>{person?.primary_department||"Company"} · priority {contact.priority}</small><h3>{person?.display_name||contact.user_id}</h3><span>{contact.full_name} · {contact.relationship}</span></div><ShieldCheck/></header><div className={styles.kv}><span>Confirmed<b>{date(contact.confirmed_at)}</b></span><span>Phone<b>{detail?.phone_e164||"Restricted"}</b></span><span>Email<b>{detail?.email||"Restricted"}</b></span><span>Notes<b>{detail?.notes||"Restricted"}</b></span></div>{!detail?<div className={styles.actions}><button type="button" onClick={()=>void reveal(contact)} disabled={busy}><Eye/>Reveal for safety use</button></div>:<div className={styles.revealed}><BadgeCheck/>This reveal was recorded in the emergency-contact audit trail.</div>}</article>})}{!data.safety_directory.length?<div className={styles.empty}>No active emergency contacts are available.</div>:null}</div>:null}

  {modal?<div className={styles.backdrop} role="presentation" onMouseDown={()=>!busy&&setModal(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={e=>e.stopPropagation()}><header><div><small>PRIVATE SAFETY RECORD</small><h3>{modal.kind==="EDIT"?(modal.contact?"Update emergency contact":"Add emergency contact"):"Deactivate emergency contact"}</h3></div><button type="button" aria-label="Close" onClick={()=>setModal(undefined)}><X/></button></header>
   {modal.kind==="EDIT"?<><div className={styles.two}><label>Priority<select value={draft.priority||"1"} onChange={e=>setDraft({...draft,priority:e.target.value})}><option value="1">1 — Primary</option><option value="2">2 — Secondary</option><option value="3">3 — Additional</option></select></label><label>Relationship<input required minLength={2} value={draft.relationship||""} onChange={e=>setDraft({...draft,relationship:e.target.value})}/></label></div><label>Full name<input required minLength={2} value={draft.name||""} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Phone (E.164)<input required placeholder="+919876543210" pattern="\+[1-9][0-9]{7,14}" value={draft.phone||""} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label><label>Email<input type="email" value={draft.email||""} onChange={e=>setDraft({...draft,email:e.target.value})}/></label><label>Safety notes<textarea maxLength={1000} value={draft.notes||""} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label><div className={styles.attest}><ShieldCheck/><span>By saving, you attest this contact is current and may be used by authorised HR/safety personnel during legitimate safety/emergency operations.</span></div></>
   :<label>Reason<textarea required minLength={3} value={draft.reason||""} onChange={e=>setDraft({...draft,reason:e.target.value})}/></label>}
   <footer><button type="button" disabled={busy} onClick={()=>setModal(undefined)}>Cancel</button><button type="submit" disabled={busy}>{busy?<LoaderCircle className={styles.spin}/>:<ShieldCheck/>}Confirm</button></footer>
  </form></div>:null}
 </section>;
}
