"use client";
import {useState,type FormEvent} from "react";
import Link from "next/link";
import {Bookmark,CornerDownRight,Edit3,Flag,History,Trash2} from "lucide-react";
import styles from "./office-connect-message-actions.module.css";
type Props={id:string;body:string;own:boolean;editedAt?:string|null;onDone:()=>void};
type RevisionResponse={created_at:string;edited_at:string|null;current_body:string;
 previous_versions:{id:number;body:string;revised_at:string}[]};
async function mutation<T>(url:string,method:string,payload?:Record<string,unknown>):Promise<T>{
 const response=await fetch(url,{method,credentials:"same-origin",
  headers:{"Content-Type":"application/json"},body:payload?JSON.stringify(payload):undefined});
 const data=await response.json().catch(()=>({})) as T&{detail?:string};
 if(!response.ok)throw new Error(data.detail||"Action not confirmed");
 return data;
}
export function OfficeConnectMessageActions({id,body,own,editedAt,onDone}:Props){
 const [editing,setEditing]=useState(false);
 const [remove,setRemove]=useState(false);
 const [draft,setDraft]=useState(body);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [historyOpen,setHistoryOpen]=useState(false);
 const [historyBusy,setHistoryBusy]=useState(false);
 const [history,setHistory]=useState<RevisionResponse|null>(null);
 const [reportOpen,setReportOpen]=useState(false);
 const [reportCategory,setReportCategory]=useState("CODE_OF_CONDUCT");
 const [reportSeverity,setReportSeverity]=useState("MEDIUM");
 const [reportDetail,setReportDetail]=useState("");
 async function save(){
  setBusy(true);setNotice("");
  try{await mutation("/api/office-chat/saved","POST",{message_id:id,save:true});
   setNotice("Saved in your private references");}
  catch(e){setNotice(e instanceof Error?e.message:"Save not confirmed")}
  finally{setBusy(false)}
 }
 async function edit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setNotice("");
  try{await mutation("/api/office-chat/messages/"+id,"PATCH",{body:draft.trim()});
   setEditing(false);onDone();}
  catch(e){setNotice(e instanceof Error?e.message:"Edit not confirmed")}
  finally{setBusy(false)}
 }
 async function toggleHistory(){
  if(historyOpen){setHistoryOpen(false);return;}
  setHistoryOpen(true);
  setHistoryBusy(true);setNotice("");
  try{
   setHistory(await mutation<RevisionResponse>("/api/office-chat/messages/"+id+"/revisions","GET"));
  }catch(e){
   setHistory(null);setNotice(e instanceof Error?e.message:"Revision history unavailable");
  }finally{setHistoryBusy(false);}
 }
 async function report(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(reportDetail.trim().length<10)return;
  setBusy(true);setNotice("");
  try{
   await mutation("/api/office-ethics","POST",{
    action:"REPORT",category:reportCategory,severity:reportSeverity,
    title:"Connect message conduct or safety report",
    report:reportDetail.trim()+"\n\nMessage reference: "+id+
      "\nChat history remains private and requires separate membership authority.",
    evidence:"/office/chat/threads/"+id,
   });
   setReportOpen(false);setReportDetail("");
   setNotice("Confidential report recorded in the independent Ethics case system.");
  }catch(e){setNotice(e instanceof Error?e.message:"Confidential report not confirmed")}
  finally{setBusy(false)}
 }
 async function del(){
  setBusy(true);setNotice("");
  try{await mutation("/api/office-chat/messages/"+id,"DELETE");
    setRemove(false);onDone();}
  catch(e){setNotice(e instanceof Error?e.message:"Deletion not confirmed")}
  finally{setBusy(false)}
 }
 return <div className={styles.actions}>
  <nav aria-label="Message actions">
   <Link href={"/office/chat/threads/"+id}><CornerDownRight size={14}/>Reply</Link>
   <button type="button" disabled={busy} onClick={()=>void save()}><Bookmark size={14}/>Save</button>
   {own?<button type="button" disabled={busy} onClick={()=>{setDraft(body);setEditing(true);setRemove(false);}}><Edit3 size={14}/>Edit</button>:null}
   {own?<button type="button" disabled={busy} onClick={()=>{setRemove(true);setEditing(false);}}><Trash2 size={14}/>Remove</button>:null}
   {editedAt?<button type="button" disabled={busy} aria-expanded={historyOpen}
     onClick={()=>void toggleHistory()}><History size={14}/>History</button>:null}
   <button type="button" disabled={busy} aria-expanded={reportOpen}
    onClick={()=>{setReportOpen(open=>!open);setEditing(false);setRemove(false);}}>
     <Flag size={14}/>Report</button>
  </nav>
  {reportOpen?<form className={styles.form} aria-label="Report a message" onSubmit={report}>
   <h3>Confidential Ethics report</h3>
   <p>The report is stored in the separate Ethics case system. Investigators do not gain access to this private conversation automatically.</p>
   <div className={styles.reportFields}>
    <label>Concern<select value={reportCategory} onChange={e=>setReportCategory(e.target.value)}>
     {["CODE_OF_CONDUCT","HARASSMENT","DISCRIMINATION","FRAUD","BRIBERY",
       "CONFLICT_OF_INTEREST","DATA_MISUSE","SECURITY","RETALIATION","SAFETY","OTHER"
     ].map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}
    </select></label>
    <label>Severity<select value={reportSeverity} onChange={e=>setReportSeverity(e.target.value)}>
      {["LOW","MEDIUM","HIGH","CRITICAL"].map(value=><option key={value}>{value}</option>)}
    </select></label>
   </div>
   <label>Explain your concern<textarea required rows={4} minLength={10} maxLength={28000}
      value={reportDetail} onChange={e=>setReportDetail(e.target.value)}
      placeholder="Describe your concern. Do not include passwords, OTP codes or sensitive credentials."/></label>
   <div><button type="button" disabled={busy} onClick={()=>setReportOpen(false)}>Cancel</button>
   <button type="submit" disabled={busy||reportDetail.trim().length<10}>
    {busy?"Submitting…":"Submit to Ethics"}</button></div>
   <Link href="/office/ethics">Open my Ethics cases</Link>
  </form>:null}
  {historyOpen?<section className={styles.history} aria-label="Previous message versions" aria-live="polite">
   <h3>Revision history</h3>
   {historyBusy?<p>Checking current membership and history…</p>:null}
   {!historyBusy&&history?<ol>{history.previous_versions.map(version=><li key={version.id}>
     <time dateTime={version.revised_at}>{new Date(version.revised_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</time>
     <p>{version.body}</p>
   </li>)}</ol>:null}
   {!historyBusy&&history&&!history.previous_versions.length?<p>No previous text versions recorded.</p>:null}
   <button type="button" onClick={()=>setHistoryOpen(false)}>Close history</button>
  </section>:null}
  {editing?<form className={styles.form} onSubmit={edit}>
    <label>Edit your message (15 minute window)<textarea required maxLength={4000} minLength={1}
       rows={3} value={draft} onChange={e=>setDraft(e.target.value)}/></label>
    <div><button type="button" onClick={()=>setEditing(false)} disabled={busy}>Cancel</button>
     <button type="submit" disabled={busy||!draft.trim()}>{busy?"Saving…":"Save revision"}</button></div>
   </form>:null}
  {remove?<div className={styles.confirm} role="alertdialog" aria-label="Confirm message removal">
    <p>Hide this message from the conversation? An audit trail and legal retention controls remain.</p>
    <div><button type="button" disabled={busy} onClick={()=>setRemove(false)}>Cancel</button>
     <button type="button" disabled={busy} onClick={()=>void del()}>{busy?"Removing…":"Confirm removal"}</button></div>
  </div>:null}
  {notice?<p role="status">{notice}</p>:null}
 </div>;
}
