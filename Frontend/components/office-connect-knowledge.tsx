"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,BookOpen,FileCheck2,RefreshCw,Search,ShieldCheck,TriangleAlert} from "lucide-react";
import {useOfficeWorkspace} from "@/components/office-workspace-context";
import styles from "./office-connect-knowledge.module.css";
type Article={id:string;article_code:string;title:string;category:string;status:string;
 current_version:number;updated_at:string};
type Version={id:string;article_id:string;version:number;status:string;
 content_text:string;published_at:string|null;change_summary?:string|null};
type KnowledgeResponse={
 capabilities:{knowledge_read:boolean};articles:Article[];
 article_versions:Version[];detail?:string;
};
const date=(value:string|null|undefined)=>{
 if(!value)return "Not recorded";
 const parsed=new Date(value);
 return Number.isNaN(parsed.getTime())?"Unavailable":
  parsed.toLocaleDateString("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"});
};
export function OfficeConnectKnowledge({articleId}:{articleId?:string}){
 const {permissions}=useOfficeWorkspace();
 const [data,setData]=useState<KnowledgeResponse|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState("ALL");
 // A role transfer can invalidate a previously readable article while its
 // tab is suspended. Hide cached content and refetch on return to visibility.
 useEffect(()=>{
  const revalidate=()=>{
   if(document.visibilityState==="visible"){
    setLoading(true);
    setRefresh(value=>value+1);
   }
  };
  document.addEventListener("visibilitychange",revalidate);
  return()=>document.removeEventListener("visibilitychange",revalidate);
 },[]);

 useEffect(()=>{
  const controller=new AbortController();
  void (async()=>{
   try{
    const response=await fetch("/api/office-knowledge",{
      cache:"no-store",credentials:"same-origin",signal:controller.signal});
    const body=await response.json().catch(()=>({})) as KnowledgeResponse;
    if(!response.ok||!Array.isArray(body.articles)||!Array.isArray(body.article_versions))
      throw new Error(response.status===403?
       "Published knowledge access is not assigned":body.detail||"Knowledge source unavailable");
    if(!controller.signal.aborted){setData(body);setError("");}
   }catch(e){
    if(!controller.signal.aborted){setData(null);setError(e instanceof Error?e.message:"Knowledge source unavailable");}
   }finally{if(!controller.signal.aborted)setLoading(false);}
  })();
  return()=>controller.abort();
 },[refresh]);
 // Even a legitimate Knowledge Hub author sees only PUBLISHED records in the
 // employee-facing Connect surface. Draft and retired content stays in source.
 const articles=useMemo(()=>(data?.articles??[]).filter(a=>a.status==="PUBLISHED"),[data]);
 const categories=useMemo(()=>["ALL",...new Set(articles.map(a=>a.category))],[articles]);
 const visible=useMemo(()=>{
  const needle=query.trim().toLocaleLowerCase();
  return articles.filter(a=>(category==="ALL"||a.category===category)&&
    (!needle||[a.title,a.article_code,a.category].some(s=>s.toLocaleLowerCase().includes(needle))));
 },[articles,query,category]);
 const selected=articleId?articles.find(a=>a.id===articleId):null;
 const version=selected?data?.article_versions.find(v=>
  v.article_id===selected.id&&v.version===selected.current_version&&v.status==="PUBLISHED"):null;
 return <section className={styles.shell} aria-label={articleId?"Published support knowledge article":"Support knowledge center"}>
  <Link href={articleId?"/office/chat/support/knowledge":"/office/chat/support"} className={styles.back}>
   <ArrowLeft size={16}/>{articleId?"Knowledge center":"Support overview"}</Link>
  <header className={styles.head}><div><p className={styles.eyebrow}>KRAVIA CONNECT · SOURCE PUBLISHED</p>
    <h1>{articleId?"Knowledge article":"Knowledge center"}</h1>
    <p>Published, audience-authorized Knowledge Hub versions only. Drafts and retired articles are never treated as instructions.</p>
   </div><button type="button" disabled={loading} onClick={()=>{
    setLoading(true);setRefresh(x=>x+1);}}><RefreshCw size={16}/>Refresh</button>
  </header>
  {error?<div className={styles.error} role="alert"><TriangleAlert size={19}/><p>{error}</p>
    <button type="button" onClick={()=>{setLoading(true);setRefresh(n=>n+1);}}>Retry</button></div>:null}
  {loading?<p role="status" aria-busy="true" className={styles.state}>Checking current published knowledge access…</p>:null}
  {!loading&&!error&&articleId?<>{selected&&version?<div className={styles.detail}>
    <article className={styles.article}>
     <header><FileCheck2 size={20}/><div><h2>{selected.title}</h2><p>{selected.article_code} · {selected.category}</p></div>
       <span>Published v{version.version}</span></header>
     <div className={styles.body}>{version.content_text}</div>
     <footer>Published {date(version.published_at)} · This is the currently published source version.</footer>
    </article>
    <aside className={styles.inspector}><h2><ShieldCheck size={18}/>Verification context</h2>
     <p>Article status: published, source version {version.version}.</p>
     <p>Source: the current authenticated Knowledge Hub read model. The content is not machine-generated or independently reapproved by chat.</p>
     <Link href="/office/knowledge">Open authoritative Knowledge Hub <ArrowRight size={16}/></Link>
     {permissions.includes("it.service.request")?<Link href="/office/chat/support/new">
       Create an authorized IT ticket <ArrowRight size={16}/></Link>:null}
    </aside>
   </div>:<div className={styles.state} role="status"><ShieldCheck size={23}/>
     <h2>Published article unavailable</h2><p>The current published version may have been withdrawn, changed or is outside your access scope.</p>
     <Link href="/office/chat/support/knowledge">Return to available knowledge</Link></div>}</>:null}
  {!loading&&!error&&!articleId?<><form onSubmit={e=>e.preventDefault()} className={styles.filters}>
    <label><Search size={16}/>Search published knowledge
      <input value={query} maxLength={100} onChange={e=>setQuery(e.target.value)}
       placeholder="Article title, category or code"/></label>
    <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>
      {categories.map(value=><option key={value} value={value}>
        {value==="ALL"?"All authorized categories":value}</option>)}</select></label>
   </form>
   <p role="status" className={styles.count}>{visible.length} of {articles.length} currently published, permitted articles</p>
   {visible.length?<div className={styles.cards}>{visible.map(article=><Link
      href={"/office/chat/support/knowledge/"+article.id} key={article.id}>
      <BookOpen size={20} aria-hidden="true"/><span><strong>{article.title}</strong>
        <small>{article.category} · Published version {article.current_version} · Source updated {date(article.updated_at)}</small></span>
      <ArrowRight size={17} aria-hidden="true"/></Link>)}</div>:
     <p className={styles.state} role="status">{articles.length?"No published articles match your search.":"No published support knowledge is available to this identity."}</p>}
   <Link href="/office/knowledge" className={styles.sourceLink}>Open canonical Knowledge Hub <ArrowRight size={16}/></Link>
  </>:null}
  <footer className={styles.foot}><ShieldCheck size={16}/>A source article is reauthorized on every request; saving a link never grants ongoing access.</footer>
 </section>;
}
