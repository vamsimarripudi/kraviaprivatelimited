"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowLeft,BookOpen,Check,Clipboard,Search,ShieldCheck} from "lucide-react";
import styles from "./office-connect-macros.module.css";
type Article={id:string;title:string;category:string;status:string;current_version:number;updated_at:string};
type Version={id:string;article_id:string;version:number;status:string;content_text:string};
type Hub={articles:Article[];article_versions:Version[];capabilities:{knowledge_read:boolean};detail?:string};
type Macro={article:Article;version:Version};
export function OfficeConnectMacros(){
 const [templates,setTemplates]=useState<Macro[]>([]);
 const [search,setSearch]=useState("");
 const [active,setActive]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  void (async()=>{
   try{
    const response=await fetch("/api/office-knowledge",{
     credentials:"same-origin",cache:"no-store",signal:controller.signal});
    const body=await response.json().catch(()=>({})) as Hub;
    if(!response.ok||body.capabilities?.knowledge_read!==true)
     throw new Error(body.detail||"Published knowledge access is not assigned");
    const rows:Macro[]=(body.articles??[]).filter(article=>
      article.status==="PUBLISHED"&&article.category==="SUPPORT")
     .flatMap(article=>{
      const version=(body.article_versions??[]).find(item=>
       item.article_id===article.id&&item.status==="PUBLISHED"&&
       item.version===article.current_version);
      return version?[{article,version}]:[];
     });
    if(controller.signal.aborted)return;
    setTemplates(rows);setError("");
   }catch(e){if(controller.signal.aborted)return;
    setTemplates([]);setError(e instanceof Error?e.message:"Knowledge source unavailable");
   }finally{if(!controller.signal.aborted)setLoading(false);}
  })();return()=>controller.abort();
 },[refresh]);
 const visible=useMemo(()=>templates.filter(row=>
  row.article.title.toLowerCase().includes(search.trim().toLowerCase())),[templates,search]);
 const selected=visible.find(row=>row.article.id===active);
 async function copy(text:string){
  setNotice("");
  try{
   if(!navigator.clipboard?.writeText)throw Error("Secure clipboard access is not available");
   await navigator.clipboard.writeText(text);
   setNotice("Reviewed template copied. No customer message was sent.");
  }catch(e){setNotice(e instanceof Error?e.message:"Copy was not confirmed");}
 }
 return <section className={styles.shell} aria-label="Connect reviewed response templates">
  <Link href="/office/chat/support" className={styles.back}><ArrowLeft size={16}/>Connect support</Link>
  <header><p>KRAVIA CONNECT · CANONICAL KNOWLEDGE</p>
   <h1>Reviewed reply templates</h1>
   <p>Only currently published SUPPORT knowledge is eligible. Copying a template never sends an email or publishes a customer reply.</p></header>
  <div className={styles.toolbar}>
   <label><Search size={16}/>Search published support templates<input value={search} maxLength={100}
    onChange={e=>setSearch(e.target.value)} placeholder="Template title"/></label>
   <button type="button" onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>Refresh source</button>
  </div>
  {loading?<p role="status">Loading authorized published templates…</p>:null}
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  {notice?<p role="status" className={styles.notice}>{notice}</p>:null}
  {!loading&&!error&&!visible.length?<p className={styles.empty}>
    No published support templates match your current authority and search.</p>:null}
  {!loading&&!error?<div className={styles.grid}><nav aria-label="Support templates">
   {visible.map(row=><button type="button" aria-current={active===row.article.id?"true":undefined}
    key={row.article.id} onClick={()=>setActive(row.article.id)}>
    <BookOpen size={18}/><span><strong>{row.article.title}</strong>
     <small>Published version {row.version.version}</small></span></button>)}
   </nav>
   <article className={styles.preview}>
    {selected?<><h2>{selected.article.title}</h2>
     <p>Published version {selected.version.version} · Copy into an authorized, separately reviewed reply.</p>
     <div className={styles.body}>{selected.version.content_text}</div>
     <button type="button" onClick={()=>void copy(selected.version.content_text)}>
      <Clipboard size={16}/>Copy verified source text</button>
    </>:<p>Select a published template to inspect its current approved version.</p>}
   </article></div>:null}
  <footer><ShieldCheck size={16}/>External replies remain subject to approved Customer Support sender, recipient and delivery checks.
   <Link href="/office/knowledge">Manage source knowledge</Link></footer>
 </section>;
}
