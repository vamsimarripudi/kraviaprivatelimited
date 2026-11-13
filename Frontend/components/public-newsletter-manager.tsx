"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import styles from "./public-access.module.css";
import { OfficeDecisionDialog } from "./office-decision-dialog";

type Campaign={
 id:string;subject:string;body_text:string;
 status:"DRAFT"|"APPROVED"|"SENDING"|"SENT"|"CANCELLED";
 created_at:string;approved_at:string|null;
 total:number;submitted:number;unknown:number;suppressed:number;pending:number;
};
type Listing={campaigns?:Campaign[];confirmedSubscribers?:number;sendingEnabled?:boolean;error?:string};
type ActionResponse={id?:string;status?:string;campaignId?:string;
 submitted?:number;unknown?:number;pending?:number;suppressed?:number;error?:string};
export function PublicNewsletterManager(){
 const [subject,setSubject]=useState("");
 const [body,setBody]=useState("");
 const [campaigns,setCampaigns]=useState<Campaign[]>([]);
 const [subscriberCount,setSubscriberCount]=useState(0);
 const [sendingEnabled,setSendingEnabled]=useState(false);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [decision,setDecision]=useState<{campaign:Campaign;action:"APPROVE"|"CANCEL"|"SEND_BATCH"}>();
 const load=useCallback(async()=>{
   try{
     const response=await fetch("/api/office-public-newsletters",{cache:"no-store"});
     const result=await response.json() as Listing;
     if(!response.ok||!result.campaigns)throw Error(result.error||"Newsletter registry unavailable.");
     setCampaigns(result.campaigns);
     setSubscriberCount(result.confirmedSubscribers||0);
     setSendingEnabled(result.sendingEnabled===true);
     setError("");
   }catch(cause){setError(cause instanceof Error?cause.message:"Cannot load newsletter registry.");}
   finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function request(data:object){
   const response=await fetch("/api/office-public-newsletters",{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify(data),
   });
   const result=await response.json() as ActionResponse;
   if(!response.ok)throw Error(result.error||"Request failed.");
   return result;
 }
 async function draft(event:FormEvent<HTMLFormElement>){
   event.preventDefault();setBusy(true);setError("");setMessage("");
   try{
     await request({action:"DRAFT",subject,body});
     setSubject("");setBody("");
     setMessage("Newsletter saved as a draft. Approval and sending are separate actions.");
     await load();
   }catch(cause){setError(cause instanceof Error?cause.message:"Cannot save draft.");}
   finally{setBusy(false);}
 }
 function decide(campaign:Campaign,action:"APPROVE"|"CANCEL"|"SEND_BATCH"){
   setDecision({campaign,action});
 }
 async function executeDecision(){
   if(!decision)return;
   const {campaign,action}=decision;
   setBusy(true);setError("");setMessage("");
   try{
     const result=await request({action,campaignId:campaign.id});
     setMessage(action==="SEND_BATCH"
       ? "Submitted: "+(result.submitted||0)+" · Unknown: "+(result.unknown||0)+
         " · Suppressed: "+(result.suppressed||0)+" · Still pending: "+(result.pending||0)+"."
       :action==="APPROVE"?"Newsletter approved. Review the recipient count before sending.":"Campaign cancelled.");
     await load();
   }catch(cause){setError(cause instanceof Error?cause.message:"Campaign action failed.");}
   finally{setBusy(false);setDecision(undefined);}
 }
 return <div>
   <section className={styles.card}>
     <h2>Audience and release controls</h2>
     <p>Confirmed active subscribers: <strong>{subscriberCount}</strong>.</p>
     <p>Sending is <strong>{sendingEnabled?"enabled":"disabled"}</strong>. Newsletters are never sent to unconfirmed or unsubscribed visitors. Drafts and approvals do not send mail.</p>
     <p>Owner MFA is required, and each send action is limited to ten recipients with an 80-message rolling 24-hour safety cap.</p>
   </section>
   <section className={styles.panel} aria-label="Prepare a newsletter draft">
     <h2>Prepare the next issue</h2>
     <form onSubmit={e=>void draft(e)}>
       <label className={styles.field}>Subject
         <input value={subject} onChange={e=>setSubject(e.target.value)} required
           minLength={5} maxLength={180} placeholder="KRAVIA | Product and company update"/>
       </label>
       <label className={styles.field}>Approved message (plain text)
         <textarea value={body} onChange={e=>setBody(e.target.value)} required
           minLength={20} maxLength={5000} rows={8}
           style={{display:"block",width:"100%",padding:14,marginTop:8,
             border:"1px solid #CBD7E3",color:"#152c44",background:"#fff",font:"14px/1.65 Arial,sans-serif",resize:"vertical"}}
           placeholder="Share one factual, reviewed company or product update. No invented features, results or endorsements."/>
       </label>
       <button type="submit" disabled={busy} className={styles.button}>Save newsletter draft</button>
     </form>
     <p className={styles.notice}>Each approved email uses the original KRAVIA branding, checked platform icons, an unsubscribe link and a plain-text fallback. Delivery cannot be started from this form.</p>
   </section>
   {message?<p role="status" className={styles.message}>{message}</p>:null}
   {error?<p role="alert" className={styles.message+" "+styles.error}>{error}</p>:null}
   <section className={styles.card} aria-label="Newsletter approval queue">
     <h2>Newsletter approval queue</h2>
     {loading?<p>Loading campaigns…</p>:campaigns.length===0?<p>No newsletter drafts exist.</p>:
       campaigns.map(c=><article key={c.id} className={styles.resource}>
         <span className={styles.tag}>{c.status} · Created {new Date(c.created_at).toLocaleDateString("en-IN")}</span>
         <h3>{c.subject}</h3>
         <details><summary>Review exact approved text</summary>
           <p style={{whiteSpace:"pre-wrap"}}>{c.body_text}</p>
         </details>
         <p>Audience snapshot: {c.total} · Submitted: {c.submitted} · Pending: {c.pending} · Unknown: {c.unknown} · Suppressed: {c.suppressed}</p>
         <div className={styles.actions}>
           {c.status==="DRAFT"?<button className={styles.button}
             type="button" disabled={busy} onClick={()=>void decide(c,"APPROVE")}>Approve issue</button>:null}
           {c.status==="DRAFT"||c.status==="APPROVED"?<button className={styles.button+" "+styles.ghost}
             type="button" disabled={busy} onClick={()=>void decide(c,"CANCEL")}>Cancel</button>:null}
           {c.status==="APPROVED"||c.status==="SENDING"?<button className={styles.button}
             type="button" disabled={busy||!sendingEnabled}
             onClick={()=>void decide(c,"SEND_BATCH")}>Send next 10</button>:null}
         </div>
       </article>)
     }
   </section>
   {decision?<OfficeDecisionDialog
     open
     eyebrow={decision.action==="SEND_BATCH"?"DELIVERY DECISION":"OWNER DECISION"}
     title={decision.action==="APPROVE"?"Approve newsletter issue":decision.action==="CANCEL"?"Cancel newsletter issue":"Send the next subscriber batch"}
     description={decision.action==="APPROVE"
       ?"Approve this exact newsletter subject and body. Approval alone does not send it."
       :decision.action==="CANCEL"
         ?"Cancel this unsent newsletter issue. It will no longer be eligible for delivery."
         :"Send the next batch to up to 10 currently confirmed subscribers. Unknown delivery outcomes are never automatically retried."}
     confirmLabel={decision.action==="APPROVE"?"Approve issue":decision.action==="CANCEL"?"Cancel issue":"Send next 10"}
     tone={decision.action==="CANCEL"?"danger":decision.action==="SEND_BATCH"?"warning":"default"}
     busy={busy}
     onCancel={()=>setDecision(undefined)}
     onConfirm={()=>void executeDecision()}
   ><p><strong>{decision.campaign.subject}</strong></p><p>Current status: {decision.campaign.status} · Audience snapshot: {decision.campaign.total}</p></OfficeDecisionDialog>:null}
 </div>;
}
