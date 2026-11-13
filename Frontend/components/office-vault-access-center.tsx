"use client";
import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowRight,BadgeCheck,LockKeyhole,RefreshCw,ShieldAlert,ShieldCheck,Undo2} from "lucide-react";
import styles from "./office-vault-access-center.module.css";
type Request={id:string;category_slug:string;resource_id:string|null;action:string;justification:string;status:string;
 requester_user_id:string;requested_until:string;review_note:string|null;created_at:string;decided_at:string|null};
type Grant={id:string;category_slug:string;resource_id:string|null;action:string;grantee_user_id:string;
 expires_at:string;granted_by:string;granted_at:string;revoked_at:string|null};
type Payload={actor_user_id:string;request_categories:string[];reviewer_categories:string[];
 my_requests:Request[];review_queue:Request[];my_grants:Grant[];administered_grants:Grant[]};
const categoryLabels:Record<string,string>={
 identity:"Company identity",registrations:"Registrations & licences",
 banking:"Banking & finance",legal:"Legal & governance",people:"People documentation",
 technology:"Technology & assets",documents:"Document evidence",custody:"Secure custody"
};
const iso=(days:number)=>new Date(Date.now()+days*24*60*60*1000).toISOString();
const pretty=(v?:string|null)=>v?new Date(v).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"Not recorded";
async function request<T>(init?:RequestInit):Promise<T>{
 const response=await fetch("/api/office-vault/access",{credentials:"same-origin",cache:"no-store",...init});
 const body=await response.json().catch(()=>({})) as T&{detail?:string};
 if(!response.ok)throw new Error(body.detail||"Vault authority is unavailable");
 return body;
}
export function OfficeVaultAccessCenter({reviewOnly=false}:{reviewOnly?:boolean}){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [retry,setRetry]=useState(0);
 const [category,setCategory]=useState("documents");
 const [resourceId,setResourceId]=useState("");
 const [operation,setOperation]=useState("READ");
 const [justification,setJustification]=useState("");
 const [days,setDays]=useState(30);
 const [decision,setDecision]=useState<{id:string;approve:boolean}|null>(null);
 const [reviewNote,setReviewNote]=useState("");
 const [revokeId,setRevokeId]=useState("");
 const [revokeReason,setRevokeReason]=useState("");
 useEffect(()=>{
  let live=true;
  void request<Payload>().then(next=>{if(live){setData(next);setError("");}})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Vault authority unavailable")})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false;};
 },[retry]);
 async function submit(payload:Record<string,unknown>,success:string){
  setBusy(true);setError("");setNotice("");
  try{
   const response=await request<Record<string,unknown>>({
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
   });
   setNotice(success+(typeof response.request_id==="string"?" · "+response.request_id:""));
   setLoading(true);setRetry(v=>v+1);
   return true;
  }catch(e){setError(e instanceof Error?e.message:"Operation not confirmed");return false;}
  finally{setBusy(false);}
 }
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const ok=await submit({action:"REQUEST",category,record_id:resourceId.trim()||undefined,
    operation,justification:justification.trim(),until:iso(days)},"Governed access request recorded; no permission has been granted");
  if(ok){setResourceId("");setJustification("");}
 }
 async function review(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!decision)return;
  const ok=await submit({action:"REVIEW",request_id:decision.id,approve:decision.approve,note:reviewNote.trim()},
   "Source-authorized review recorded");
  if(ok){setDecision(null);setReviewNote("");}
 }
 async function revoke(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const ok=await submit({action:"REVOKE",grant_id:revokeId,reason:revokeReason.trim()},"Access grant revoked");
  if(ok){setRevokeId("");setRevokeReason("");}
 }
 return <section className={styles.shell} aria-label="K-Vault access administration">
  <header className={styles.heading}><div><p>K-VAULT · REQUESTS AND GRANTS</p>
   <h2>{reviewOnly?"Independent access review":"My Vault access"}</h2>
   <span>Every record read additionally requires current Office source permissions, an active scoped grant and audit evidence.</span></div>
   <button type="button" aria-label="Refresh access records" onClick={()=>{setLoading(true);setRetry(n=>n+1)}}>
    <RefreshCw size={16}/> Refresh</button>
  </header>
  {notice?<p className={styles.notice} role="status"><BadgeCheck size={17}/>{notice}</p>:null}
  {error?<div role="alert" className={styles.error}><ShieldAlert size={18}/>{error}
   <button type="button" onClick={()=>{setLoading(true);setRetry(v=>v+1);}}>Retry</button></div>:null}
  {loading?<p role="status" aria-busy="true">Loading access authority…</p>:null}
  {!reviewOnly&&!loading&&data?<form onSubmit={create} className={styles.form}>
    <h3>Request least-privilege access</h3>
    <p>Access requests are reviewed independently and never activate immediately. Restricted names are not searchable.</p>
    <div className={styles.two}><label>Category<select value={category} onChange={e=>{setCategory(e.target.value);setResourceId("");}}>
     {data.request_categories.map(key=><option value={key} key={key}>{categoryLabels[key]||key}</option>)}
    </select></label><label>Requested action<select value={operation} onChange={e=>setOperation(e.target.value)}>
      <option value="READ">Read metadata</option><option value="PREVIEW">View secured preview</option><option value="DOWNLOAD">Download permitted evidence</option>
    </select></label></div>
    <label>Exact record ID (optional)<input value={resourceId} onChange={e=>setResourceId(e.target.value)}
      placeholder="Known UUID only — leave empty for category access" maxLength={36}
      pattern="[0-9a-fA-F-]{36}"/>
     <small>Specific record grants are supported for registrations, document instances and custody items. Other categories require category-level requests.</small>
    </label>
    <label>Business justification<textarea required minLength={15} maxLength={500} rows={3}
      value={justification} onChange={e=>setJustification(e.target.value)}
      placeholder="Explain the task, scope and why access is needed."/></label>
    <label>Requested duration<select value={days} onChange={e=>setDays(Number(e.target.value))}>
      <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
    </select></label>
    <button type="submit" disabled={busy}>{busy?"Submitting…":"Submit access request"}</button>
  </form>:null}
  {!reviewOnly&&data?<section className={styles.panel}><h3>My requests · {data.my_requests.length}</h3>
    {!data.my_requests.length?<p>No access requests recorded.</p>:<div className={styles.rows}>
      {data.my_requests.map(r=><article key={r.id}><div><strong>{categoryLabels[r.category_slug]} · {r.action}</strong>
       <span>{r.status} · Submitted {pretty(r.created_at)}</span>
       <span>{r.resource_id?"Specific source record":"Category scope"} · Until {pretty(r.requested_until)}</span>
       {r.review_note?<small>Reviewer note: {r.review_note}</small>:null}
       </div></article>)}
    </div>}</section>:null}
  {!reviewOnly&&data?<section className={styles.panel}><h3>My current grants · {data.my_grants.filter(g=>!g.revoked_at&&new Date(g.expires_at).getTime()>Date.now()).length}</h3>
    {!data.my_grants.length?<p>No governed grants recorded.</p>:<div className={styles.rows}>
     {data.my_grants.map(g=><article key={g.id}><ShieldCheck size={19}/><div>
       <strong>{categoryLabels[g.category_slug]} · {g.action}</strong>
       <span>{g.revoked_at?"Revoked":new Date(g.expires_at).getTime()<Date.now()?"Expired":"Effective"} · Expires {pretty(g.expires_at)}</span>
       <span>{g.resource_id?"Record-specific":"Category-level"} · Subject to source permission</span>
      </div></article>)}</div>}</section>:null}
  {data?.reviewer_categories.length?<section className={styles.panel}>
    <h3>Independent review · {data.review_queue.filter(r=>r.requester_user_id!==data.actor_user_id).length} pending</h3>
    <p>Your current source-review authority permits: {data.reviewer_categories.map(key=>categoryLabels[key]).join(", ")}.</p>
    {!data.review_queue.length?<p>No review items assigned to the available scope.</p>:<div className={styles.rows}>
      {data.review_queue.filter(r=>r.requester_user_id!==data.actor_user_id).map(r=><article key={r.id}>
       <LockKeyhole size={20}/><div>
        <strong>{categoryLabels[r.category_slug]} · {r.action}</strong>
        <span>Requester ID: {r.requester_user_id} · Expiry {pretty(r.requested_until)}</span>
        <p>{r.justification}</p>
        <div className={styles.buttons}>
         <button type="button" disabled={busy} onClick={()=>{setDecision({id:r.id,approve:false});setReviewNote("");}}>Deny</button>
         <button type="button" disabled={busy} onClick={()=>{setDecision({id:r.id,approve:true});setReviewNote("");}}>Review grant</button>
        </div>
       </div>
      </article>)}</div>}
    {decision?<form className={styles.form} onSubmit={review}><h3>Confirm {decision.approve?"access grant":"access denial"}</h3>
      <p>This operation changes only the Vault overlay. Source access, department ownership and MFA are independently rechecked.</p>
      <label>Independent decision rationale<textarea required={!decision.approve} minLength={decision.approve?0:10}
        rows={3} maxLength={2000} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/></label>
      <div className={styles.buttons}><button type="button" disabled={busy} onClick={()=>setDecision(null)}>Cancel</button>
       <button type="submit" disabled={busy}>{busy?"Reviewing…":decision.approve?"Approve scoped grant":"Deny request"}</button></div>
     </form>:null}
   </section>:null}
  {data?.reviewer_categories.length?<section className={styles.panel}><h3>Revoke active grants</h3>
    <div className={styles.rows}>{data.administered_grants.filter(g=>new Date(g.expires_at).getTime()>Date.now()).map(g=>
      <article key={g.id}><ShieldCheck size={18}/><div><strong>{categoryLabels[g.category_slug]} · {g.action}</strong>
       <span>Grantee ID: {g.grantee_user_id} · Expires {pretty(g.expires_at)}</span>
       {revokeId===g.id?<form className={styles.form} onSubmit={revoke}>
         <label>Revocation reason<textarea required minLength={10} maxLength={2000}
            value={revokeReason} onChange={e=>setRevokeReason(e.target.value)}/></label>
         <div className={styles.buttons}><button type="button" onClick={()=>{setRevokeId("");setRevokeReason("");}}>Cancel</button>
          <button type="submit" disabled={busy}><Undo2 size={15}/>Confirm revocation</button></div>
        </form>:<button type="button" onClick={()=>setRevokeId(g.id)}>Revoke access</button>}
      </div></article>)}</div>
  </section>:null}
  <p className={styles.footer}><ShieldCheck size={16}/>No self-approval, automatic role escalation, secret storage or implicit external notifications.
   <Link href="/office/requests">Formal Office workflow <ArrowRight size={14}/></Link></p>
 </section>;
}
