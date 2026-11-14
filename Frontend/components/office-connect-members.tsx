"use client";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {Plus,RefreshCw,ShieldCheck,UsersRound,X} from "lucide-react";
import styles from "./office-connect-members.module.css";

type Member={user_id:string;display_name:string};
type Membership={members:Member[];can_manage_members:boolean;kind:string};
type Person={user_id:string;display_name:string;job_title?:string};
async function load<T>(url:string,init?:RequestInit):Promise<T>{
 const response=await fetch(url,{cache:"no-store",credentials:"same-origin",...init});
 const body=await response.json().catch(()=>({})) as T&{detail?:string};
 if(!response.ok)throw Error(body.detail||"Membership authority is temporarily unavailable");
 return body;
}
/** Only the active members can see this panel. Every request re-verifies Office AAL2
 * and effective department/group membership on the server. */
export function OfficeConnectMembers({conversationId,onChanged}:{conversationId:string;onChanged:()=>void}){
 const [data,setData]=useState<Membership|null>(null);
 const [directory,setDirectory]=useState<Person[]>([]);
 const [search,setSearch]=useState("");
 const [selection,setSelection]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [addMode,setAddMode]=useState(false);
 useEffect(()=>{
  let mounted=true;
  void load<Membership>("/api/office-chat/conversations/"+encodeURIComponent(conversationId)+"/members")
   .then(next=>{if(mounted){setData(next);setError("");}})
   .catch(e=>{if(mounted){setData(null);setError(e instanceof Error?e.message:"Membership unavailable");}})
   .finally(()=>{if(mounted)setLoading(false);});
  return()=>{mounted=false;};
 },[conversationId,refresh]);
 useEffect(()=>{
  if(!addMode||!data?.can_manage_members)return;
  let mounted=true;
  void load<{employees:Person[]}>("/api/office-chat/directory")
   .then(next=>{if(mounted)setDirectory(next.employees);})
   .catch(e=>{if(mounted)setError(e instanceof Error?e.message:"Directory unavailable");});
  return()=>{mounted=false;};
 },[addMode,data?.can_manage_members]);
 const candidates=useMemo(()=>{
  const existing=new Set(data?.members.map(row=>row.user_id)??[]);
  const needle=search.trim().toLocaleLowerCase("en-IN");
  return directory.filter(person=>!existing.has(person.user_id)&&
   (!needle||person.display_name.toLocaleLowerCase("en-IN").includes(needle))).slice(0,30);
 },[directory,data?.members,search]);
 async function add(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!selection||busy||!data?.can_manage_members)return;
  setBusy(true);setError("");setNotice("");
  try{
   await load("/api/office-chat/conversations/"+encodeURIComponent(conversationId)+"/members",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({user_id:selection}),
   });
   setNotice("Verified colleague added to the private group; recorded in its membership audit.");
   setSelection("");setSearch("");setAddMode(false);setLoading(true);
   setRefresh(n=>n+1);onChanged();
  }catch(e){setError(e instanceof Error?e.message:"Group membership not confirmed")}
  finally{setBusy(false);}
 }
 return <aside className={styles.panel} id="office-connect-members" aria-label="Authorized conversation participants">
  <header><div><UsersRound size={19} aria-hidden="true"/><h2>Current members</h2></div>
   <button type="button" aria-label="Refresh current members" disabled={loading||busy}
    onClick={()=>{setLoading(true);setRefresh(n=>n+1);}}><RefreshCw size={17}/></button></header>
  <p>Membership is verified against the current Office identity, not historical participation.</p>
  {loading?<p role="status" aria-busy="true">Checking authorized participants…</p>:null}
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  {!loading&&!error&&data?<><p className={styles.count}>{data.members.length} active member(s) · {data.kind}</p>
   <ul className={styles.people}>{data.members.map(person=><li key={person.user_id}>
    <span className={styles.avatar} aria-hidden="true">{person.display_name.slice(0,1).toUpperCase()}</span>
    <span>{person.display_name}</span>
   </li>)}</ul>
   {data.can_manage_members&&data.members.length<30?<button className={styles.addToggle} type="button"
     aria-expanded={addMode} onClick={()=>setAddMode(open=>!open)}>
     {addMode?<X size={16}/>:<Plus size={16}/>} {addMode?"Cancel addition":"Add verified colleague"}
    </button>:null}
   {addMode&&data.can_manage_members?<form onSubmit={add} className={styles.form}>
    <label>Search eligible colleague<input value={search} maxLength={80} onChange={e=>setSearch(e.target.value)}
      placeholder="Name from authorized directory"/></label>
    <label>Colleague<select value={selection} onChange={e=>setSelection(e.target.value)}>
     <option value="">Select a verified employee</option>
     {candidates.map(person=><option value={person.user_id} key={person.user_id}>
      {person.display_name}{person.job_title?" · "+person.job_title:""}</option>)}</select></label>
    {!directory.length?<p>Directory is empty or still loading. No member can be added without confirmation.</p>:null}
    <button type="submit" disabled={busy||!selection}>{busy?"Confirming…":"Add to group"}</button>
   </form>:null}
  </>:null}
  {notice?<p className={styles.success} role="status">{notice}</p>:null}
  <footer><ShieldCheck size={16} aria-hidden="true"/>Membership does not grant operational approval, HR access or customer data.</footer>
 </aside>;
}
