"use client";
import {useEffect,useState,type FormEvent} from "react";

type Resource={
 slug:string;title:string;summary:string;file_name:string;
 byte_size:number;status:"DRAFT"|"PUBLISHED"|"RETIRED";
 checksum_sha256:string;created_at:string;published_at?:string|null;
};
export function OfficePublicResources(){
 const [items,setItems]=useState<Resource[]>([]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function load(){
  const response=await fetch("/api/office/public-resources",{cache:"no-store"});
  if(!response.ok)throw Error("Could not read approved resource inventory.");
  const body=await response.json() as {resources:Resource[]};
  setItems(body.resources||[]);
 }
 useEffect(()=>{void load().catch(()=>setError("The public resource inventory is unavailable."));},[]);
 async function upload(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage("");setError("");
  const element=event.currentTarget;
  const data=new FormData(element);
  try{
   const response=await fetch("/api/office/public-resources",{method:"POST",body:data});
   const body=await response.json() as {error?:string;slug?:string};
   if(!response.ok)throw Error(body.error||"Upload failed.");
   setMessage("Resource uploaded as a private draft. Review it before publishing.");
   element.reset();await load();
  }catch(e){setError(e instanceof Error?e.message:"Upload failed.");}finally{setBusy(false);}
 }
 async function decide(slug:string,action:"PUBLISH"|"RETIRE"){
  const confirmation=window.confirm(action==="PUBLISH"?
   "Confirm that the resource is accurate, rights-cleared, non-confidential and approved for public downloading.":
   "Retire this resource and prevent new downloads?");
  if(!confirmation)return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/office/public-resources/"+encodeURIComponent(slug)+"/decision",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,confirmed:true})
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw Error(result.error||"The decision failed.");
   setMessage(action==="PUBLISH"?"Approved resource published.":"Resource retired.");await load();
  }catch(e){setError(e instanceof Error?e.message:"The decision failed.");}finally{setBusy(false);}
 }
 const field={display:"block",marginBottom:16,fontSize:13,fontWeight:700} as const;
 const control={width:"100%",padding:11,border:"1px solid #aabcc9",marginTop:7} as const;
 return <div style={{padding:"20px 28px 60px",maxWidth:940}}>
  <section aria-label="Public resource publication" style={{background:"#fff",padding:26,border:"1px solid #d0dee8",marginBottom:22}}>
   <p style={{fontSize:12,letterSpacing:2,color:"#39617f"}}>OWNER CONTROL · PUBLIC RESOURCE LIBRARY</p>
   <h2 style={{margin:"8px 0 14px",fontFamily:"Georgia,serif"}}>Review and publish approved downloads</h2>
   <p style={{fontSize:13,lineHeight:1.65}}>Files start as private drafts. Only an authenticated KRAVIA Office OWNER with MFA can approve publication. No Office files are copied automatically.</p>
   <form onSubmit={e=>void upload(e)}>
    <label style={field}>Resource slug<input style={control} required name="slug" pattern="[a-z0-9][a-z0-9-]{2,79}" maxLength={80} placeholder="company-overview-2026"/></label>
    <label style={field}>Public title<input style={control} required name="title" minLength={5} maxLength={160}/></label>
    <label style={field}>Description<textarea style={{...control,minHeight:90}} required name="summary" minLength={10} maxLength={1200}/></label>
    <label style={field}>Approved file (PDF, TXT, CSV or ZIP; max 2 MiB)<input style={control} required type="file" name="file" accept=".pdf,.txt,.csv,.zip"/></label>
    <button type="submit" disabled={busy} style={{padding:"12px 22px",background:"#193b5b",color:"#fff",border:0,cursor:"pointer"}}>{busy?"Saving…":"Upload private draft"}</button>
   </form>
  </section>
  {message?<p role="status" style={{background:"#e5f2e8",padding:14}}>{message}</p>:null}
  {error?<p role="alert" style={{background:"#fff1ee",padding:14}}>{error}</p>:null}
  <section aria-label="Resource inventory">
   <h2 style={{fontFamily:"Georgia,serif"}}>Resource inventory</h2>
   {items.length===0?<p>No resources have been uploaded.</p>:items.map(item=><article key={item.slug} style={{background:"#fff",border:"1px solid #d9e3ea",padding:18,marginBottom:12}}>
    <div style={{display:"flex",flexWrap:"wrap",gap:12,justifyContent:"space-between"}}>
     <div><h3 style={{margin:"0 0 6px"}}>{item.title}</h3><p style={{margin:"0 0 8px"}}>{item.summary}</p><code>{item.slug} · {item.file_name} · {Math.round(item.byte_size/1024)} KB</code><p>State: <strong>{item.status}</strong></p></div>
     <div>{item.status==="DRAFT"||item.status==="RETIRED"?<button type="button" disabled={busy} onClick={()=>void decide(item.slug,"PUBLISH")} style={{padding:11,marginRight:8}}>Approve & publish</button>:null}
       {item.status==="PUBLISHED"?<button type="button" disabled={busy} onClick={()=>void decide(item.slug,"RETIRE")} style={{padding:11}}>Retire</button>:null}</div>
    </div></article>)}
  </section>
 </div>;
}
