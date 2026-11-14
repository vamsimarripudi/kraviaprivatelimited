"use client";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,ClipboardCheck,Headphones,LockKeyhole,RefreshCw,Search,ShieldCheck,Ticket,TriangleAlert} from "lucide-react";
import styles from "./office-connect-workflows.module.css";
import { useOfficeWorkspace } from "@/components/office-workspace-context";

type TicketRow={id:string;ticket_code:string;title:string;description:string;category:string;priority:string;status:string;requester_user_id:string;owner_user_id?:string|null;due_at?:string|null;created_at:string;updated_at:string};
type ItData={actor:{user_id:string};capabilities:{manage:boolean;read_company:boolean};tickets:TicketRow[];events:{id:string;ticket_id:string;event_type:string;note?:string|null;created_at:string}[];disclaimer:string};
type WorkData={identity:{user_id:string};approvals:{step:{id:string;request_id:string;required_permission?:string;status:string};request:{id:string;title:string;description:string;priority:string;status:string;request_type_code:string;created_at:string}|null}[];requests:{id:string;title:string;status:string}[]};
type Knowledge={id:string;title:string;category:string;status:string;current_version:number;created_at:string;audience_type:string};
type KnowledgeVersion={id:string;article_id:string;version:number;status:string;content_text:string;published_at?:string|null};
type Announcement={id:string;title:string;body_text:string;priority:string;requires_ack:boolean;status:string;published_at?:string|null;expires_at?:string|null};
type KnowledgeData={actor:{user_id:string};articles:Knowledge[];article_versions:KnowledgeVersion[];announcements:Announcement[];announcement_receipts:{announcement_id:string;acknowledged_at?:string|null}[];capabilities:{announcement_manage:boolean}};
type ApiState={it?:ItData;work?:WorkData;knowledge?:KnowledgeData};
const rawUUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function query<T>(url:string,opts?:RequestInit):Promise<T>{
 const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...opts});
 const body=await response.json().catch(()=>({})) as T&{detail?:string};
 if(!response.ok)throw new Error(body.detail||"Source workflow is unavailable");
 return body;
}
const related=[
 {href:"/office/it",label:"IT service desk",detail:"Canonical tickets and assignment"},
 {href:"/office/support",label:"Customer Support",detail:"Customer cases and remedies"},
 {href:"/office/requests",label:"Formal requests",detail:"Workflow authority and evidence"},
 {href:"/office/approvals",label:"Approval inbox",detail:"Independent approval decisions"},
 {href:"/office/knowledge",label:"Knowledge Hub",detail:"Reviewed and published knowledge"},
 {href:"/office/access",label:"Access administration",detail:"Delegated role and grant administration"},
];
const pageNames:Record<string,string>={
 "support/new":"Create IT ticket","support/mine":"My support tickets","support/assigned":"Assigned tickets",
 "support/team":"Team support queue","support/sla":"SLA & deadline watch",
 "support/knowledge":"Knowledge center","support/analytics":"Support analytics",
 "support/macros":"Reply templates","support/customers":"Customer correspondence",
 "support/escalations":"Escalation inbox","mentions":"Mentions","saved":"Saved messages",
 "files":"Shared files","search":"Search","announcements":"Company announcements",
 "ai":"KRAVIA Intelligence","settings":"Personal preferences","admin":"Connect administration",
 "admin/channels":"Channel governance","admin/queues":"Support queue governance",
 "admin/sla":"Service-level policy","admin/retention":"Retention and audit",
 "admin/integrations":"External communications policy","admin/permissions":"Communication access matrix"
};
const forIT=new Set(["support/new","support/mine","support/assigned","support/team","support/sla","support/analytics","support/escalations"]);
const forWork=new Set(["admin/permissions","support/escalations","admin"]);
const forKnowledge=new Set(["support/knowledge","announcements","support/macros"]);
function dt(value?:string|null){if(!value)return "Not recorded";const time=new Date(value);return Number.isNaN(time.getTime())?"Unavailable":time.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});}
function sourceLinks(filter?:string){
 const list=filter?related.filter(item=>item.href.includes(filter)):related;
 return <nav className={styles.sources} aria-label="Source-owned workflows">{list.map(link=><Link href={link.href} key={link.href}><span><strong>{link.label}</strong><small>{link.detail}</small></span><ArrowRight size={17}/></Link>)}</nav>;
}
export function OfficeConnectWorkflows({path}:{path:string}){
 const { permissions } = useOfficeWorkspace();
 const [state,setState]=useState<ApiState>({});
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [reload,setReload]=useState(0);
 const [filter,setFilter]=useState("");
 const [priority,setPriority]=useState("NORMAL");
 const [category,setCategory]=useState("OTHER");
 const [title,setTitle]=useState("");
 const [description,setDescription]=useState("");
 const [pending,setPending]=useState(false);
 const [notice,setNotice]=useState("");
 const [decisionNote,setDecisionNote]=useState("");
 const [decision,setDecision]=useState<"APPROVE"|"REJECT"|null>(null);
 const ticketId=path.match(/^support\/tickets\/(.+)$/)?.[1];
 const approvalId=path.match(/^approvals\/(.+)$/)?.[1];
 const articleKey=path.match(/^support\/knowledge\/(.+)$/)?.[1];
 const escalationId=path.match(/^support\/escalations\/(.+)$/)?.[1];
 const requiresIT=forIT.has(path)||!!ticketId||!!escalationId;
 const requiresWork=forWork.has(path)||!!approvalId;
 const requiresKnowledge=forKnowledge.has(path)||!!articleKey;
 useEffect(()=>{
  let active=true;
  void (async()=>{
   try{
    const [it,work,knowledge]=await Promise.all([
      requiresIT?query<ItData>("/api/office-it"):Promise.resolve(undefined),
      requiresWork?query<WorkData>("/api/office-work/overview"):Promise.resolve(undefined),
      requiresKnowledge?query<KnowledgeData>("/api/office-knowledge"):Promise.resolve(undefined)
    ]);
    if(active){setState({it,work,knowledge});setError("");}
   }catch(e){if(active)setError(e instanceof Error?e.message:"The source workflow is unavailable");}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[path,reload,requiresIT,requiresWork,requiresKnowledge]);
 const heading= pageNames[path] || (ticketId?"Ticket workspace":approvalId?"Approval decision room":articleKey?"Knowledge article":escalationId?"Escalation detail":"Restricted workflow");
 const tickets=useMemo(()=>state.it?.tickets??[],[state.it?.tickets]);
 const filtered=useMemo(()=>{
  const needle=filter.trim().toLowerCase();
  const mine=path==="support/mine"?tickets.filter(t=>t.requester_user_id===state.it?.actor.user_id)
    :path==="support/assigned"?tickets.filter(t=>t.owner_user_id===state.it?.actor.user_id)
    :tickets;
  return mine.filter(t=>!needle||[t.title,t.ticket_code,t.category,t.priority,t.status].some(v=>v?.toLowerCase().includes(needle)));
 },[tickets,path,state.it?.actor.user_id,filter]);
 const req=approvalId?state.work?.approvals.find(x=>x.request?.id===approvalId):undefined;
 const ownTicket=ticketId?tickets.find(t=>t.id===ticketId):undefined;
 const article=articleKey?state.knowledge?.articles.find(x=>x.id===articleKey):undefined;
 const articleVersion=article?state.knowledge?.article_versions.find(x=>x.article_id===article.id&&x.status==="PUBLISHED"&&x.version===article.current_version):undefined;
 const future=state.it?.tickets.filter(t=>t.due_at&&!["RESOLVED","CLOSED","CANCELLED"].includes(t.status))??[];
 async function submitTicket(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending)return;setPending(true);setNotice("");setError("");
  try{
   const response=await query<{ticket_id:string}>("/api/office-it",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"CREATE_TICKET",category,priority,title:title.trim(),description:description.trim()})
   });
   setNotice("IT ticket recorded by the canonical service: "+response.ticket_id);
   setTitle("");setDescription("");setReload(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:"Ticket not confirmed");}
  finally{setPending(false);}
 }
 async function submitDecision(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!approvalId||!decision||pending)return;setPending(true);setNotice("");setError("");
  try{
   const result=await query<{status:string}>("/api/office-work/requests/"+encodeURIComponent(approvalId)+"/decision",{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({decision,note:decisionNote.trim()})
   });
   setDecision(null);setDecisionNote("");setNotice("Canonical request decision recorded: "+result.status);setReload(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:"Decision was not confirmed");}
  finally{setPending(false);}
 }
 async function ack(announcement:Announcement){
  setPending(true);setError("");setNotice("");
  try{
   await query("/api/office-knowledge",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"ANNOUNCEMENT_RECEIPT",announcement_id:announcement.id,acknowledged:true})});
   setNotice("Acknowledgement recorded in Knowledge Hub");setReload(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:"Acknowledgement not confirmed");}
  finally{setPending(false);}
 }
 const unavailable=<div className={styles.restricted} role="status"><LockKeyhole size={28}/>
  <h2>Resource unavailable</h2><p>The source returned no authorized record for this request. The identifier and record details are not disclosed.</p>
  <Link href="/office/chat/support">Return to Connect support</Link></div>;
 return <section className={styles.shell} aria-label="KRAVIA Connect workspaces">
  <header className={styles.header}><div><Link className={styles.back} href="/office/chat"><ArrowLeft size={16}/>Connect</Link>
   <p className={styles.eyebrow}>KRAVIA CONNECT · SOURCE-OWNED</p><h1>{heading}</h1>
   <p>Live authorized source records only. Conversations do not grant approvals, access or financial authority.</p></div>
   <button type="button" onClick={()=>{setLoading(true);setReload(v=>v+1);}}><RefreshCw size={16}/>Refresh</button></header>
  {notice?<p className={styles.success} role="status"><CheckCircle2 size={16}/>{notice}</p>:null}
  {error?<div className={styles.error} role="alert"><TriangleAlert size={18}/><span>{error}</span>
    <button type="button" onClick={()=>{setLoading(true);setReload(v=>v+1);}}>Retry</button></div>:null}
  {loading?<div className={styles.loading} role="status" aria-busy="true">Loading authorized source records…</div>:null}
  {!loading&&!error&&path==="support/new"&&!permissions.includes("it.service.request")
   ? <div className={styles.restricted} role="status"><LockKeyhole size={24}/>
       <h2>IT service request access not assigned</h2>
       <p>Request the required authority through KRAVIA Office. Creating a ticket does not grant access or execute a change.</p>
       <Link href="/office/requests">Open formal requests <ArrowRight size={15}/></Link>
     </div> : null}
  {!loading&&!error&&path==="support/new"&&permissions.includes("it.service.request")?<form className={styles.form} onSubmit={submitTicket}>
   <h2>IT service request</h2><p>Creates a canonical IT ticket. Customer cases continue through Customer Support, not this form.</p>
   <label>Subject<input required minLength={3} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <div className={styles.columns}>
    <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>
      {["DEVICE","SOFTWARE","ACCESS","EMAIL","MFA","NETWORK","VPN","PRINTER","SECURITY","OTHER"].map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}>
      {["LOW","NORMAL","HIGH","URGENT"].map(c=><option key={c}>{c}</option>)}</select></label>
   </div>
   <label>Description<textarea required rows={5} maxLength={5000} minLength={3} value={description} onChange={e=>setDescription(e.target.value)}/></label>
   <p>Do not include passwords, private keys or OTP codes. Attachments are managed by the canonical authorized evidence workflow.</p>
   <button type="submit" disabled={pending}>{pending?"Submitting…":"Create IT ticket"}</button>
  </form>:null}
  {!loading&&!error&&(path==="support/mine"||path==="support/assigned"||path==="support/team")?
   <div className={styles.records}>
    {path!=="support/mine"&&!(state.it?.capabilities.manage||state.it?.capabilities.read_company)?<div className={styles.restricted}>Team queue access is not assigned. Only your permitted tickets may be viewed.</div>:
    <><label className={styles.filter}>Filter tickets<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Subject, code, status…"/></label>
    <p>{filtered.length} authorized ticket(s)</p>{filtered.length?filtered.map(t=><Link className={styles.record} key={t.id} href={"/office/chat/support/tickets/"+t.id}>
      <Ticket size={20}/><span><strong>{t.title}</strong><small>{t.ticket_code} · {t.priority} · {t.status} · Updated {dt(t.updated_at)}</small></span><ArrowRight size={18}/></Link>)
      :<div className={styles.empty}>No matching authorized IT tickets.</div>}</>}
   </div>:null}
  {!loading&&!error&&ticketId?(rawUUID.test(ticketId)&&ownTicket?
    <article className={styles.detail}><header><h2>{ownTicket.title}</h2><span>{ownTicket.ticket_code} · {ownTicket.status}</span></header>
     <p>{ownTicket.description}</p><dl><dt>Priority</dt><dd>{ownTicket.priority}</dd><dt>Category</dt><dd>{ownTicket.category}</dd>
      <dt>Requested</dt><dd>{dt(ownTicket.created_at)}</dd><dt>Due</dt><dd>{dt(ownTicket.due_at)}</dd></dl>
     <h3>Authorized case history</h3>{state.it?.events.filter(e=>e.ticket_id===ticketId).length?
       <ol>{state.it.events.filter(e=>e.ticket_id===ticketId).map(e=><li key={e.id}>{e.event_type} · {dt(e.created_at)}
         {e.note?<p>{e.note}</p>:null}</li>)}</ol>:<p>No accessible case events.</p>}
     <Link href="/office/it">Open canonical IT service desk <ArrowRight size={15}/></Link>
    </article>:unavailable):null}
  {!loading&&!error&&path==="support/knowledge"?<div className={styles.records}>
   <label className={styles.filter}>Search published knowledge<input value={filter} onChange={e=>setFilter(e.target.value)}/></label>
   {state.knowledge?.articles.filter(a=>a.status==="PUBLISHED"&&a.title.toLowerCase().includes(filter.toLowerCase())).map(a=>
    <Link className={styles.record} href={"/office/chat/support/knowledge/"+a.id} key={a.id}><BookOpen size={20}/>
      <span><strong>{a.title}</strong><small>{a.category} · Published version {a.current_version}</small></span><ArrowRight size={17}/></Link>)}
   {!state.knowledge?.articles.some(a=>a.status==="PUBLISHED")?<div className={styles.empty}>No published articles are visible to this account.</div>:null}
  </div>:null}
  {!loading&&!error&&articleKey?(article&&articleVersion?<article className={styles.detail}>
    <h2>{article.title}</h2><p>Source: Knowledge Hub · Published version {articleVersion.version}</p>
    <div className={styles.articleBody}>{articleVersion.content_text}</div>
    <Link href="/office/knowledge">View source and revision history <ArrowRight size={16}/></Link>
   </article>:unavailable):null}
  {!loading&&!error&&path==="announcements"?<div className={styles.records}>
   {state.knowledge?.announcements.filter(a=>a.status==="PUBLISHED").map(a=><article className={styles.detail} key={a.id}>
     <header><h2>{a.title}</h2><span>{a.priority} · {dt(a.published_at)}</span></header>
     <p className={styles.articleBody}>{a.body_text}</p>
     {a.requires_ack&&!state.knowledge?.announcement_receipts.some(r=>r.announcement_id===a.id&&r.acknowledged_at)?
       <button type="button" disabled={pending} onClick={()=>void ack(a)}>Acknowledge</button>:
       <small>Read/acknowledgement is subject to Knowledge Hub policy</small>}
    </article>)}
   {!state.knowledge?.announcements.some(a=>a.status==="PUBLISHED")?<div className={styles.empty}>No published announcements are visible.</div>:null}
  </div>:null}
  {!loading&&!error&&approvalId?(rawUUID.test(approvalId)&&req?.request?
    <article className={styles.detail}>
      <header><h2>{req.request.title}</h2><span>{req.request.request_type_code} · {req.request.status}</span></header>
      <p>{req.request.description}</p>
      <p>This request is assigned to your current approval inbox. The canonical workflow rechecks capability, segregation of duties and MFA.</p>
      {decision?<form onSubmit={submitDecision} className={styles.form}>
       <h3>Confirm {decision==="APPROVE"?"approval":"rejection"}</h3>
       <label>Decision rationale<textarea required={decision==="REJECT"} value={decisionNote} onChange={e=>setDecisionNote(e.target.value)} rows={3} maxLength={2000}/></label>
       <p>Approval does not execute an underlying payment, credential grant or fulfillment.</p>
       <div className={styles.actions}><button type="button" disabled={pending} onClick={()=>setDecision(null)}>Cancel</button>
       <button type="submit" disabled={pending}>{pending?"Recording…":"Submit canonical "+decision.toLowerCase()}</button></div></form>:
       <div className={styles.actions}><button type="button" onClick={()=>setDecision("REJECT")}>Reject</button>
       <button type="button" onClick={()=>setDecision("APPROVE")}>Approve (server verified)</button></div>}
      <Link href="/office/approvals">Open formal approval workflow <ArrowRight size={16}/></Link>
    </article>:unavailable):null}
  {!loading&&!error&&path==="support/analytics"&&state.it?
   <div className={styles.stats}><article><b>{tickets.length}</b><span>Visible IT tickets</span></article>
     <article><b>{tickets.filter(t=>!["RESOLVED","CLOSED","CANCELLED"].includes(t.status)).length}</b><span>Active</span></article>
     <article><b>{tickets.filter(t=>t.priority==="URGENT").length}</b><span>Urgent</span></article>
     <article><b>{future.filter(t=>t.due_at&&new Date(t.due_at).getTime()<Date.now()).length}</b><span>Past due</span></article></div>:null}
  {!loading&&!error&&(path==="support/sla"||path==="support/escalations"||!!escalationId)?
    <div className={styles.records}>
     <p>Actual deadlines from the authorized IT service. The existing service has not published a separate Connect SLA or escalation event ledger; this view does not invent events or timers.</p>
     {future.length?future.map(t=><Link className={styles.record} key={t.id} href={"/office/chat/support/tickets/"+t.id}>
       <TriangleAlert size={19}/><span><strong>{t.title}</strong><small>Due {dt(t.due_at)} · {t.status}</small></span><ArrowRight size={16}/></Link>):<div className={styles.empty}>No active tickets with recorded deadlines.</div>}
    </div>:null}
  {!loading&&!error&&(path==="support/macros"||path==="support/customers")?
    <div className={styles.detail}>
     <h2>Governed correspondence</h2>
     <p>{path==="support/macros"?"Only approved Knowledge Hub content may be reused as a draft; no external send or published macro is inferred.":"Customer-facing correspondence is controlled by the existing Customer Support and approved mail delivery mechanisms."}</p>
     {sourceLinks(path==="support/macros"?"knowledge":"support")}
    </div>:null}
  {!loading&&!error&&(
   path.startsWith("admin")||path==="ai"||path==="settings"||
   path==="files"||path==="mentions"||path==="saved"||path==="search"
  )?<div className={styles.detail}>
   <ShieldCheck size={25}/><h2>Current authorized source workflows</h2>
   <p>Only source-owned actions are exposed. Separate Connect search, file sharing, AI and governance services require independently approved server policies; no local imitation or fabricated result is displayed.</p>
   {sourceLinks()}
  </div>:null}
  {!loading&&!error&&!(
    pageNames[path]||ticketId||approvalId||articleKey||escalationId
  )?unavailable:null}
  <footer className={styles.foot}><ShieldCheck size={16}/>Source-level permissions are checked by the existing Office authority on every protected request.</footer>
 </section>;
}
