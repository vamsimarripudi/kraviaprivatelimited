"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {ArrowRight,FileCheck2,Search,ShieldCheck} from "lucide-react";
import styles from "./office-vault-company-records.module.css";
export type CompanyMasterRow={
 id:string;title:string;code:string;type:string;authority:string;jurisdiction:string;
 maskedIdentifier:string;status:string;issuedOn:string|null;expiresOn:string|null;
 renewalOn:string|null;updatedAt:string;verified:boolean;evidenceLinked:boolean;
};
const date=(x:string|null)=>x?new Date(x).toLocaleDateString("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"}):"Not recorded";
export function OfficeVaultCompanyRecords({records,generatedAt}:{records:readonly CompanyMasterRow[];generatedAt:string}){
 const [search,setSearch]=useState("");const [status,setStatus]=useState("ALL");
 const statuses=useMemo(()=>["ALL",...new Set(records.map(x=>x.status))],[records]);
 const visible=useMemo(()=>records.filter(row=>(status==="ALL"||row.status===status)&&
  [row.title,row.code,row.type,row.authority,row.jurisdiction]
   .some(value=>value.toLowerCase().includes(search.trim().toLowerCase()))),[records,status,search]);
 return <section className={styles.master} aria-label="Authorized company master">
  <header><div><h2>Company master</h2><p>Verified source records only. Values are masked and cannot be edited through this index.</p></div>
   <Link href="/office/registrations">Canonical registry <ArrowRight size={16}/></Link></header>
  <div className={styles.metrics}>
   <article><span>Accessible records</span><strong>{records.length}</strong></article>
   <article><span>Verified records</span><strong>{records.filter(x=>x.verified).length}</strong></article>
   <article><span>Linked evidence</span><strong>{records.filter(x=>x.evidenceLinked).length}</strong></article>
  </div>
  <form className={styles.filters} onSubmit={e=>e.preventDefault()}>
   <label><Search size={16}/>Find source records<input value={search} maxLength={100}
    onChange={e=>setSearch(e.target.value)} placeholder="Search permitted titles, types or authorities"/></label>
   <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>
    {statuses.map(s=><option key={s} value={s}>{s==="ALL"?"All statuses":s}</option>)}</select></label>
  </form>
  <p role="status" className={styles.note}>{visible.length} of {records.length} permitted records · Source refreshed {date(generatedAt)}</p>
  {visible.length?<div className={styles.grid}>{visible.map(row=><article key={row.id}>
   <header><FileCheck2 size={20}/><div><h3>{row.title}</h3><small>{row.code} · {row.type}</small></div>
    <strong>{row.status}</strong></header>
   <dl><dt>Authority</dt><dd>{row.authority}</dd><dt>Jurisdiction</dt><dd>{row.jurisdiction}</dd>
    <dt>Masked identifier</dt><dd>{row.maskedIdentifier}</dd><dt>Issued</dt><dd>{date(row.issuedOn)}</dd>
    <dt>Expires</dt><dd>{date(row.expiresOn)}</dd><dt>Renewal due</dt><dd>{date(row.renewalOn)}</dd>
    <dt>Verification</dt><dd>{row.verified?"Recorded":"Awaiting verification"}</dd>
    <dt>Evidence</dt><dd>{row.evidenceLinked?"Linked":"Not linked"}</dd></dl>
   <footer><small>Last updated {date(row.updatedAt)}</small>
    <Link href={"/office/k-vault/records/"+row.id}>Open record <ArrowRight size={15}/></Link></footer>
  </article>)}</div>:<div className={styles.empty}>No granted records match these filters.
    <Link href="/office/k-vault/requests">Request access</Link></div>}
  <p className={styles.note}><ShieldCheck size={16}/>Official changes and independent verification remain source-controlled.</p>
 </section>;
}
