"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import styles from "./office-connect.module.css";
type Person={user_id:string;display_name:string;job_title?:string};
export function OfficeConnectCreateGroup(){
 const router=useRouter();
 const [people,setPeople]=useState<Person[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 const [title,setTitle]=useState("");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
   let active=true;
   void (async()=>{try{
    const response=await fetch("/api/office-chat/directory",{credentials:"same-origin",cache:"no-store"});
    const data=await response.json().catch(()=>({})) as {employees?:Person[];detail?:string};
    if(!response.ok)throw new Error(data.detail||"Unable to load eligible members");
    if(active){setPeople(data.employees??[]);setError("");}
   }catch(error){if(active)setError(error instanceof Error?error.message:"Unable to load employees")}
   finally{if(active)setLoading(false);}})();
   return()=>{active=false};
 },[retry]);
 async function create(event:FormEvent<HTMLFormElement>){
   event.preventDefault();if(!title.trim()||!selected.length||busy)return;
   setBusy(true);setError("");
   try {
    const response=await fetch("/api/office-chat/groups",{method:"POST",
     credentials:"same-origin",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({title:title.trim(),members:selected})});
    const result=await response.json().catch(()=>({})) as {conversation_id?:string;detail?:string};
    if(!response.ok||!result.conversation_id)throw new Error(result.detail||"Group not confirmed");
    router.push("/office/chat/groups/"+result.conversation_id);
   }catch(error){setError(error instanceof Error?error.message:"Group not confirmed");setBusy(false);}
 }
 return <section className={styles.directory}>
  <Link href="/office/chat" className={styles.back}><ArrowLeft size={16}/>Connect</Link>
  <p className={styles.eyebrow}>KRAVIA CONNECT · COLLABORATION</p><h1>Create a private group</h1>
  <p>Only the verified members you select may view messages. Group discussion never grants operational permissions.</p>
  {error?<div role="alert" className={styles.error}><p>{error}</p><button type="button" onClick={()=>{setLoading(true);setRetry(n=>n+1);}}>Retry</button></div>:null}
  <form onSubmit={create} className={styles.groupForm}>
   <label htmlFor="office-group-name">Group name</label>
   <input id="office-group-name" required minLength={3} maxLength={120} value={title}
     onChange={e=>setTitle(e.target.value)} placeholder="Team or project conversation"/>
   <fieldset><legend>Choose verified members (1–29)</legend>
    {loading?<p role="status">Loading eligible employees…</p>:
    <div className={styles.groupPeople}>{people.map(person=><label key={person.user_id}>
      <input type="checkbox" value={person.user_id} disabled={busy || (selected.length>=29&&!selected.includes(person.user_id))}
        checked={selected.includes(person.user_id)}
        onChange={e=>setSelected(prev=>e.target.checked?[...prev,person.user_id]:prev.filter(id=>id!==person.user_id))}/>
      <span>{person.display_name}<small>{person.job_title||"Employee"}</small></span>
    </label>)}</div>}
   </fieldset>
   <button type="submit" disabled={!title.trim()||!selected.length||busy||loading}>
    <Users size={16} aria-hidden="true"/>{busy?"Creating…":"Create private group"}
   </button>
  </form>
 </section>;
}
