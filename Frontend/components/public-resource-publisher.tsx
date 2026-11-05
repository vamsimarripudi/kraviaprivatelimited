"use client";
import { useState, type FormEvent } from "react";
import styles from "./public-access.module.css";
import { OfficeDecisionDialog } from "./office-decision-dialog";
type Resource={slug:string;title:string;summary:string;file_name:string;byte_size:number;status:string;checksum_sha256:string};
export function PublicResourcePublisher({initial}:{initial:Resource[]}){
 const [resources,setResources]=useState(initial);
 const [slug,setSlug]=useState("");
 const [title,setTitle]=useState("");
 const [summary,setSummary]=useState("");
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [decision,setDecision]=useState<{slug:string;title:string;action:"PUBLISH"|"RETIRE"}>();
 async function refresh(){
  const response=await fetch("/api/office-public-resources",{cache:"no-store"});
  if(!response.ok)throw new Error("Could not refresh approved files.");
  const body=await response.json() as {resources:Resource[]};
  setResources(body.resources);
 }
 async function upload(event:FormEvent){
  event.preventDefault();setBusy(true);setNotice("");
  try{
   if(!file)throw new Error("Select an approved public document.");
   const data=new FormData();data.set("slug",slug);data.set("title",title);
   data.set("summary",summary);data.set("file",file);
   const response=await fetch("/api/office-public-resources",{method:"POST",body:data});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||"Upload failed.");
   await refresh();setSlug("");setTitle("");setSummary("");setFile(null);
   setNotice("Resource stored as private draft. It is not downloadable until you explicitly publish it.");
  }catch(err){setNotice(err instanceof Error?err.message:"Upload failed.");}
  finally{setBusy(false);}
 }
 function decide(slug:string,title:string,action:"PUBLISH"|"RETIRE"){
  setDecision({slug,title,action});
 }
 async function executeDecision(){
  if(!decision)return;
  const {slug,action}=decision;
  setBusy(true);setNotice("");
  try{
   const response=await fetch("/api/office-public-resources",{method:"PATCH",headers:{"content-type":"application/json"},
     body:JSON.stringify({slug,action})});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||"Could not change publication status.");
   await refresh();setNotice(action==="PUBLISH"?"Resource published.":"Resource retired.");
  }catch(err){setNotice(err instanceof Error?err.message:"Could not update resource.");}
  finally{setBusy(false);setDecision(undefined);}
 }
 return <div>
  <div className={styles.card}>
   <h2>Upload a reviewed resource</h2>
   <p>Only approved, non-confidential PDF, UTF-8 text or CSV, up to 2 MiB. Active Office OWNER/MFA is required for all actions. Never upload financial evidence, employee records or unapproved marketing claims.</p>
   <form onSubmit={e=>void upload(e)}>
    <label className={styles.field}>Resource slug (lowercase, hyphenated)
     <input required minLength={3} maxLength={80} pattern="[a-z0-9][a-z0-9-]{2,79}" value={slug} onChange={e=>setSlug(e.target.value)} placeholder="kravia-public-overview"/>
    </label>
    <label className={styles.field}>Title
     <input required minLength={5} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="KRAVIA company overview"/>
    </label>
    <label className={styles.field}>Public description
     <input required minLength={10} maxLength={1200} value={summary} onChange={e=>setSummary(e.target.value)}/>
    </label>
    <label className={styles.field}>Reviewed file
     <input type="file" required accept=".pdf,.txt,.csv,application/pdf,text/plain,text/csv"
       onChange={e=>setFile(e.target.files?.[0]||null)}/>
    </label>
    <button type="submit" disabled={busy} className={styles.button}>Save private draft</button>
   </form>
  </div>
  <div className={styles.card}><h2>Publication register</h2>
   {!resources.length?<p>No public resource files have been uploaded.</p>:
    resources.map(r=><div key={r.slug} className={styles.resource}>
     <strong>{r.title}</strong><p>{r.summary}</p><span className={styles.tag}>{r.status} · {r.file_name} · {Math.ceil(r.byte_size/1024)} KB</span>
     <span className={styles.mini}>SHA-256 {r.checksum_sha256}</span>
     <div className={styles.actions}>
      <a className={styles.button+" "+styles.ghost}
        href={"/api/office-public-resources/"+encodeURIComponent(r.slug)+"/preview"}>
        Review exact file
      </a>
      {r.status==="DRAFT"?<button disabled={busy} type="button" className={styles.button} onClick={()=>decide(r.slug,r.title,"PUBLISH")}>Approve and publish</button>:null}
      {r.status==="PUBLISHED"?<button disabled={busy} type="button" className={styles.button+" "+styles.ghost} onClick={()=>decide(r.slug,r.title,"RETIRE")}>Retire resource</button>:null}
     </div>
    </div>)}
  </div>
  {notice?<p className={styles.message} role="status">{notice}</p>:null}
  {decision?<OfficeDecisionDialog
    open
    eyebrow={decision.action==="PUBLISH"?"PUBLICATION DECISION":"RETIREMENT DECISION"}
    title={decision.action==="PUBLISH"?"Publish reviewed resource":"Retire public resource"}
    description={decision.action==="PUBLISH"
      ?"Publish this reviewed resource to the public catalogue. Confirm content, licence, safety and privacy review before release."
      :"Retire this resource and disable future public downloads. Existing audit evidence remains preserved."}
    confirmLabel={decision.action==="PUBLISH"?"Approve and publish":"Retire resource"}
    tone={decision.action==="PUBLISH"?"warning":"danger"}
    busy={busy}
    onCancel={()=>setDecision(undefined)}
    onConfirm={()=>void executeDecision()}
  ><p><strong>{decision.title}</strong></p><p>Resource key: {decision.slug}</p></OfficeDecisionDialog>:null}
 </div>;
}
