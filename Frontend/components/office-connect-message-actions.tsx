"use client";
import {useState,type FormEvent} from "react";
import Link from "next/link";
import {Bookmark,CornerDownRight,Edit3,Flag,Trash2} from "lucide-react";
import styles from "./office-connect-message-actions.module.css";
type Props={id:string;body:string;own:boolean;onDone:()=>void};
async function mutation<T>(url:string,method:string,payload?:Record<string,unknown>):Promise<T>{
 const response=await fetch(url,{method,credentials:"same-origin",
  headers:{"Content-Type":"application/json"},body:payload?JSON.stringify(payload):undefined});
 const data=await response.json().catch(()=>({})) as T&{detail?:string};
 if(!response.ok)throw new Error(data.detail||"Action not confirmed");
 return data;
}
export function OfficeConnectMessageActions({id,body,own,onDone}:Props){
 const [editing,setEditing]=useState(false);
 const [remove,setRemove]=useState(false);
 const [draft,setDraft]=useState(body);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
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
   <Link href="/office/ethics"><Flag size={14}/>Report</Link>
  </nav>
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
