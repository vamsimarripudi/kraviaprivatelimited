"use client";
import {useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowRight,FileCheck2,FileLock2,FolderLock,KeyRound,LockKeyhole,
 Plus,RefreshCw,ShieldCheck,UploadCloud,X,Search,Eye,Download,AlertTriangle} from "lucide-react";
import styles from "./office-vault-secret-locker.module.css";
type Version={
 id:string;version_number:number;filename:string;mime_type:string;byte_size:number;
 scan_state:string;review_state:string;created_at:string;reviewed_at:string|null;
};
type Document={
id:string;title:string;classification:string;state:string;
 created_at:string;updated_at:string;is_owner:boolean;grant_active:boolean;versions:Version[];
};
type Data={
 as_of:string;actor_user_id:string;capabilities:{upload:boolean;review:boolean;read:boolean};
 documents:Document[];detail?:string;
};
const classifications=["CONFIDENTIAL","RESTRICTED","BOARD","FINANCE","HR","LEGAL","SECURITY"] as const;
const dt=(date:string)=>new Date(date).toLocaleString("en-IN",{
 dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"
});
export function OfficeVaultSecretLocker(){
 const [data,setData]=useState<Data|null>(null);
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [filter,setFilter]=useState("");
 const [classification,setClassification]=useState("ALL");
 const [busy,setBusy]=useState(false);
 const [title,setTitle]=useState("");
 const [kind,setKind]=useState<typeof classifications[number]>("RESTRICTED");
 const [file,setFile]=useState<File|null>(null);
 const [revision,setRevision]=useState("");
 const [reviewNote,setReviewNote]=useState("");
 const [reviewVersion,setReviewVersion]=useState<Version|null>(null);
 const uploadDialog=useRef<HTMLDialogElement>(null);
 const reviewDialog=useRef<HTMLDialogElement>(null);
 const uploadFocus=useRef<HTMLButtonElement>(null);
 const reviewFocus=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const controller=new AbortController();
  void (async()=>{
   try{
    const response=await fetch("/api/office-vault/secrets",{
     credentials:"same-origin",cache:"no-store",signal:controller.signal});
    const body=await response.json().catch(()=>({})) as Data;
    if(!response.ok||!Array.isArray(body.documents))
     throw new Error(body.detail||"Sealed document locker unavailable");
    if(!controller.signal.aborted){setData(body);setError("");}
   }catch(e){
    if(!controller.signal.aborted){
     setData(null);setError(e instanceof Error?e.message:"Vault authority unavailable");
    }
   }finally{if(!controller.signal.aborted)setLoading(false);}
  })();
  return()=>controller.abort();
 },[refresh]);
 const visible=useMemo(()=>{
  if(!data)return [];
  const needle=filter.trim().toLowerCase();
  return data.documents.filter(d=>
   (classification==="ALL"||d.classification===classification)&&
   (!needle||[d.title,d.classification,...d.versions.map(v=>v.filename)]
    .some(value=>value.toLowerCase().includes(needle))));
 },[data,filter,classification]);
 async function modify(action:Record<string,unknown>){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/office-vault/secrets",{
    method:"PATCH",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(action),
   });
   const result=await response.json().catch(()=>({})) as {status?:string;detail?:string};
   if(!response.ok||!result.status)throw new Error(result.detail||"Vault action not confirmed");
   setNotice("Source-confirmed document status: "+result.status);
   setLoading(true);setRefresh(v=>v+1);
   reviewDialog.current?.close();setReviewVersion(null);setReviewNote("");
  }catch(e){setError(e instanceof Error?e.message:"Vault operation failed");}
  finally{setBusy(false);}
 }
 async function upload(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!file||file.size>10_485_760||file.size<1||busy||title.trim().length<3)return;
  setBusy(true);setError("");setNotice("");
  try{
   const form=new FormData();
   form.set("title",title.trim());form.set("classification",kind);
   form.set("file",file);
   if(revision)form.set("document_id",revision);
   const response=await fetch("/api/office-vault/secrets",{
     method:"POST",body:form,credentials:"same-origin",
   });
   const result=await response.json().catch(()=>({})) as {status?:string;detail?:string};
   if(!response.ok||!result.status)throw new Error(result.detail||"Sealed upload not confirmed");
   setNotice(result.status==="CLEAN"?
    "Encrypted and scanner-clean. Independent reviewer approval is still required.":
    result.status==="BLOCKED"?"File blocked by the security scanner.":
    "Encrypted upload remains quarantined until the scanner confirms safety.");
   uploadDialog.current?.close();
   setTitle("");setFile(null);setRevision("");
   uploadFocus.current?.focus();
   setLoading(true);setRefresh(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:"Sealed upload unavailable");}
  finally{setBusy(false);}
 }
 function openUpload(document?:Document){
  setTitle(document?.title||"");
  setKind((classifications.find(c=>c===document?.classification))||"RESTRICTED");
  setRevision(document?.id||"");
  setFile(null);uploadDialog.current?.showModal();
 }
 function openReview(version:Version,trigger:HTMLButtonElement){
  reviewFocus.current=trigger;setReviewVersion(version);setReviewNote("");
  reviewDialog.current?.showModal();
 }
 function closeReview(){
  if(busy)return;
  reviewDialog.current?.close();setReviewVersion(null);setReviewNote("");
  reviewFocus.current?.focus();
 }
 return <section className={styles.locker} aria-label="K-Vault enterprise secret locker">
  <header className={styles.head}><div><p className={styles.eyebrow}>K-VAULT · ENCRYPTED CUSTODY</p>
    <h2><FolderLock size={24}/> Secret document locker</h2>
    <p>Sealed versions, independent malware scanning, maker-checker review, managed-device assurance and expiring read grants.</p>
   </div>
   <div className={styles.actions}>
    <button type="button" disabled={loading||busy} onClick={()=>{setLoading(true);setRefresh(x=>x+1);}}>
     <RefreshCw size={16}/>Refresh</button>
    {data?.capabilities.upload?<button ref={uploadFocus} type="button" onClick={()=>openUpload()}>
     <Plus size={16}/>Seal document</button>:null}
   </div>
  </header>
  {notice?<p className={styles.notice} role="status"><ShieldCheck size={16}/>{notice}</p>:null}
  {error?<div className={styles.error} role="alert"><AlertTriangle size={17}/>{error}
    <button type="button" onClick={()=>{setLoading(true);setRefresh(x=>x+1);}}>Retry</button></div>:null}
  {loading?<p className={styles.empty} role="status" aria-busy="true">Verifying AAL2, managed device and document grants…</p>:null}
  {!loading&&data?<><div className={styles.metrics}>
    <article><span>Accessible evidence references</span><strong>{data.documents.length}</strong></article>
    <article><span>Pending independent reviews</span><strong>{data.documents.flatMap(d=>d.versions).filter(v=>v.review_state==="PENDING").length}</strong></article>
    <article><span>Currently downloadable</span><strong>{data.documents.filter(d=>d.grant_active)
      .flatMap(d=>d.versions).filter(v=>v.review_state==="APPROVED"&&v.scan_state==="CLEAN").length}</strong></article>
   </div>
   <div className={styles.filters}>
    <label><Search size={16}/>Search permitted documents
     <input value={filter} onChange={e=>setFilter(e.target.value)} maxLength={120} placeholder="Title or filename"/></label>
    <label>Classification<select value={classification} onChange={e=>setClassification(e.target.value)}>
     <option value="ALL">All available</option>{classifications.map(v=><option key={v}>{v}</option>)}
    </select></label>
   </div>
   <p className={styles.count} role="status">{visible.length} currently visible document(s) · Data as of {dt(data.as_of)}</p>
   {visible.length?<div className={styles.documents}>{visible.map(doc=><article key={doc.id}>
     <header><FileLock2 size={22}/><div><h3>{doc.title}</h3><small>{doc.classification} · {doc.is_owner?"Your controlled upload":"Granted or review scope"}</small></div></header>
     <ol>{doc.versions.map(version=><li key={version.id}>
      <div><strong>{version.filename}</strong><small>Version {version.version_number} · {(version.byte_size/1024).toFixed(1)} KiB · {dt(version.created_at)}</small>
       <small>Scan: {version.scan_state} · Independent review: {version.review_state}</small></div>
      <div className={styles.versionActions}>
       {doc.is_owner&&version.scan_state==="QUARANTINED"?
        <button type="button" disabled={busy} onClick={()=>void modify({action:"RETRY_SCAN",version_id:version.id})}>
         <RefreshCw size={15}/>Retry scanner</button>:null}
       {data.capabilities.review&&!doc.is_owner&&version.review_state==="PENDING"?
        <button ref={reviewFocus} type="button" disabled={busy}
         onClick={event=>openReview(version,event.currentTarget)}>
         <FileCheck2 size={15}/>Review</button>:null}
       {doc.grant_active&&version.scan_state==="CLEAN"&&version.review_state==="APPROVED"?<>
        {["application/pdf","image/jpeg","image/png","image/webp"].includes(version.mime_type)?
         <a href={"/api/office-vault/secrets/"+version.id+"/preview"} target="_blank" rel="noreferrer">
          <Eye size={15}/>Protected preview</a>:null}
        <a href={"/api/office-vault/secrets/"+version.id+"/download"}>
          <Download size={15}/>Download (grant checked)</a>
       </>:null}
      </div>
     </li>)}</ol>
     <footer>
      {doc.is_owner&&data.capabilities.upload?<button type="button" onClick={()=>openUpload(doc)} disabled={busy}>
        <UploadCloud size={16}/>Propose new encrypted version</button>:null}
      {!doc.grant_active?<Link href="/office/k-vault/requests">Request governed read or download <ArrowRight size={16}/></Link>:null}
     </footer>
    </article>)}</div>:<p className={styles.empty}>No permitted records match these filters. Access does not reveal other company documents.</p>}
   <nav className={styles.links} aria-label="K-Vault control routes">
    <Link href="/office/k-vault/requests"><KeyRound size={17}/>Access requests</Link>
    <Link href="/office/k-vault/activity"><ShieldCheck size={17}/>My audit events</Link>
    {data.capabilities.review?<Link href="/office/k-vault/reviews"><FileCheck2 size={17}/>Source reviews</Link>:null}
   </nav>
  </>:null}
  <p className={styles.notice}><LockKeyhole size={16}/>Stored objects are encrypted. Uploading never authorizes reading; a clean scanner verdict, independent review and a current per-record grant are required before any file is released.</p>
  <dialog className={styles.dialog} ref={uploadDialog} onCancel={e=>{if(busy)e.preventDefault();}}>
   <form onSubmit={upload}>
    <header><div><p className={styles.eyebrow}>PRIVATE COMPANY EVIDENCE</p>
      <h2>{revision?"Propose new sealed version":"Seal company document"}</h2></div>
      <button type="button" aria-label="Close upload" disabled={busy}
       onClick={()=>uploadDialog.current?.close()}><X size={18}/></button></header>
    <label>Document title<input required minLength={3} maxLength={180} value={title}
     onChange={e=>setTitle(e.target.value)}/></label>
    <label>Classification<select value={kind} disabled={!!revision}
     onChange={e=>setKind(e.target.value as typeof kind)}>
     {classifications.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Verified document file<input required type="file"
     accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
    <p>Max 10 MiB · PDF/JPEG/PNG/WebP/DOCX/XLSX · No password, private key or raw database backup content. No email or external notice is sent.</p>
    <div className={styles.actions}><button type="button" disabled={busy} onClick={()=>uploadDialog.current?.close()}>Cancel</button>
     <button type="submit" disabled={busy||!file||file.size>10_485_760||file.size<1||title.trim().length<3}>
      {busy?"Encrypting and verifying…":"Encrypt & quarantine"}</button></div>
   </form>
  </dialog>
  <dialog className={styles.dialog} ref={reviewDialog} onCancel={e=>{if(busy)e.preventDefault();}}>
   <div className={styles.reviewForm}><header><div><p className={styles.eyebrow}>INDEPENDENT MAKER-CHECKER</p>
     <h2>Review sealed document</h2></div>
     <button type="button" disabled={busy} onClick={closeReview} aria-label="Close secret review"><X size={18}/></button></header>
    <p>Current scan: {reviewVersion?.scan_state||"Not verified"}. Only scanner-clean uploads can be approved; your own uploads cannot be reviewed by you.</p>
    <label>Independent evidence rationale<textarea required rows={4} minLength={12} maxLength={2000}
     value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/></label>
    <div className={styles.actions}>
     <button type="button" disabled={busy} onClick={closeReview}>Cancel</button>
     <button type="button" disabled={busy||reviewNote.trim().length<12||!reviewVersion}
      onClick={()=>reviewVersion&&void modify({action:"REVIEW",version_id:reviewVersion.id,approve:false,note:reviewNote})}>Reject</button>
     <button type="button" disabled={busy||reviewNote.trim().length<12||reviewVersion?.scan_state!=="CLEAN"}
      onClick={()=>reviewVersion&&void modify({action:"REVIEW",version_id:reviewVersion.id,approve:true,note:reviewNote})}>Approve clean version</button>
    </div>
   </div>
  </dialog>
 </section>;
}
