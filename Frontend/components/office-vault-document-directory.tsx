"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {ArrowRight,FileCheck2,FileLock2,Search,ShieldCheck} from "lucide-react";
import styles from "./office-vault-document-directory.module.css";
export type VaultDocumentSummary={
 id:string;title:string;code:string;classification:string;status:string;
 createdAt:string;outputCount:number;
};
function date(value:string){
 const parsed=new Date(value);
 return Number.isNaN(parsed.getTime())?"Not recorded":
 parsed.toLocaleDateString("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"});
}
export function OfficeVaultDocumentDirectory({records}:{records:readonly VaultDocumentSummary[]}){
 const [search,setSearch]=useState("");
 const [classification,setClassification]=useState("ALL");
 const [status,setStatus]=useState("ALL");
 const categories=useMemo(()=>["ALL",...new Set(records.map(r=>r.classification))],[records]);
 const statuses=useMemo(()=>["ALL",...new Set(records.map(r=>r.status))],[records]);
 const visible=useMemo(()=>records.filter(record=>{
  if(classification!=="ALL"&&record.classification!==classification)return false;
  if(status!=="ALL"&&record.status!==status)return false;
  const needle=search.trim().toLocaleLowerCase();
  return !needle||[record.title,record.code,record.classification,record.status]
    .some(value=>value.toLocaleLowerCase().includes(needle));
 }),[records,search,classification,status]);
 const withOutputs=records.filter(r=>r.outputCount>0).length;
 return <section className={styles.directory} aria-label="Authorized K-Vault document directory">
  <header className={styles.head}><div><h2>Authorized document inventory</h2>
    <p>Document Studio retains the authoritative evidence and controls preview, signing, output and download.</p></div>
    <Link href="/office/documents">Document Studio <ArrowRight size={16}/></Link>
  </header>
  <div className={styles.metrics}>
    <article><span>Visible document references</span><strong>{records.length}</strong></article>
    <article><span>Documents with source outputs</span><strong>{withOutputs}</strong></article>
    <article><span>Without visible output</span><strong>{records.length-withOutputs}</strong></article>
  </div>
  <form className={styles.filters} onSubmit={e=>e.preventDefault()}>
   <label><Search size={16}/>Search permitted documents
     <input value={search} maxLength={120} onChange={e=>setSearch(e.target.value)}
      placeholder="Title, document code or classification"/></label>
   <label>Classification<select value={classification} onChange={e=>setClassification(e.target.value)}>
     {categories.map(c=><option value={c} key={c}>{c==="ALL"?"All allowed":c}</option>)}</select></label>
   <label>Source status<select value={status} onChange={e=>setStatus(e.target.value)}>
     {statuses.map(s=><option value={s} key={s}>{s==="ALL"?"All statuses":s}</option>)}</select></label>
  </form>
  <p className={styles.count} role="status">{visible.length} of {records.length} accessible documents</p>
  {!visible.length?<p role="status" className={styles.empty}>
    {records.length?"No authorized documents match the selected filters.":"No current document record grants are available."}
    <Link href="/office/k-vault/requests">Request scoped access</Link>
   </p>:<div className={styles.cards}>{visible.map(doc=><article key={doc.id}>
    <FileLock2 size={23} aria-hidden="true"/>
    <div><h3>{doc.title}</h3>
     <small>{doc.code}</small>
     <dl><dt>Classification</dt><dd>{doc.classification}</dd>
       <dt>Status</dt><dd>{doc.status}</dd>
       <dt>Recorded</dt><dd>{date(doc.createdAt)}</dd>
       <dt>Source outputs</dt><dd>{doc.outputCount} recorded (authorization rechecked on access)</dd></dl>
    </div>
    <Link href={"/office/k-vault/documents/"+doc.id}>View reference <ArrowRight size={16}/></Link>
   </article>)}</div>}
  <p className={styles.note}><ShieldCheck size={16}/>A generated or signed source-output status is not proof that an uploaded file passed malware scanning. File bytes remain unavailable until the canonical scanner, evidence and current action permission allow release.</p>
  <Link className={styles.manage} href="/office/documents"><FileCheck2 size={17}/>Create or verify evidence in Document Studio <ArrowRight size={16}/></Link>
 </section>;
}
