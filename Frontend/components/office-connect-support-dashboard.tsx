"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Headphones, Laptop, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import styles from "./office-connect-support.module.css";
import { useOfficeWorkspace } from "@/components/office-workspace-context";

type ITTicket={id:string;ticket_code:string;title:string;status:string;priority:string;created_at:string;requester_user_id:string};
type Case={id:string;case_code:string;subject:string;status:string;priority:string;created_at:string};
type IT={actor:{user_id:string};tickets:ITTicket[];capabilities:{manage:boolean}};
type Support={cases:Case[];scope:{type?:string};can_manage:boolean};
type Result<T>={data?:T;reason?:string};
async function source<T>(url:string):Promise<Result<T>>{
 try{
  const response=await fetch(url,{credentials:"same-origin",cache:"no-store"});
  const data=await response.json().catch(()=>({})) as T&{detail?:string};
  if(response.status===401||response.status===403)return {reason:"Not assigned to your current authority"};
  if(!response.ok)throw new Error(data.detail??"Canonical service temporarily unavailable");
  return {data};
 }catch(e){return {reason:e instanceof Error?e.message:"Canonical service temporarily unavailable"};}
}
export function OfficeConnectSupportDashboard(){
 const { permissions } = useOfficeWorkspace();
 const [it,setIt]=useState<Result<IT>>({});
 const [support,setSupport]=useState<Result<Support>>({});
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;
  void Promise.all([source<IT>("/api/office-it"),source<Support>("/api/office-support")])
   .then(([i,s])=>{if(active){setIt(i);setSupport(s);}})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;};
 },[refresh]);
 const tickets=it.data?.tickets??[];
 const cases=support.data?.cases??[];
 const activeTickets=tickets.filter(t=>!["RESOLVED","CLOSED","CANCELLED"].includes(t.status));
 const activeCases=cases.filter(c=>!["RESOLVED","CLOSED"].includes(c.status));
 return <section className={styles.shell} aria-label="Connect Support overview">
  <header className={styles.header}>
   <div><Link href="/office/chat"><ArrowLeft size={16}/>Connect</Link>
    <p>SUPPORT · CANONICAL IT AND CUSTOMER CASES</p><h1>Service & support</h1>
    <span>One operational view, two independent source systems. Queue and record permissions stay with IT and Customer Support.</span></div>
   <button type="button" onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}><RefreshCw size={17}/>Refresh</button>
  </header>
  {loading?<p role="status" aria-busy="true">Loading authorized support queues…</p>:null}
  {!loading?<div className={styles.stats}>
   <article><b>{tickets.length}</b><span>Authorized IT tickets</span></article>
   <article><b>{activeTickets.length}</b><span>Active IT tickets</span></article>
   <article><b>{cases.length}</b><span>Authorized customer cases</span></article>
   <article><b>{activeCases.length}</b><span>Active customer cases</span></article>
  </div>:null}
  <div className={styles.columns}>
   <section className={styles.panel} aria-label="IT service queue">
    <header><Laptop size={21}/><div><h2>IT service desk</h2>
     <small>{it.reason??"Scoped to your current IT permissions"}</small></div>
     {permissions.includes("it.service.request")?<Link href="/office/chat/support/new"><Plus size={15}/>New IT ticket</Link>:null}</header>
    {!loading&&it.reason?<p className={styles.warning} role="status">{it.reason}. No restricted tickets are displayed.</p>:null}
    {!loading&&!it.reason&&!tickets.length?<p>No IT tickets currently visible.</p>:null}
    {!loading&&tickets.slice(0,12).map(t=><Link key={t.id} className={styles.ticket}
      href={"/office/chat/support/tickets/"+t.id}>
     <span><strong>{t.title}</strong><small>{t.ticket_code} · {t.priority} · {t.status}</small></span>
     <ArrowRight size={16}/></Link>)}
    <Link href="/office/it" className={styles.source}>Open canonical IT administration <ArrowRight size={15}/></Link>
   </section>
   <section className={styles.panel} aria-label="Customer Support queue">
    <header><Headphones size={21}/><div><h2>Customer Support</h2>
     <small>{support.reason??"Case and refund authority remain separate"}</small></div>
     <Link href="/office/support">Open cases</Link></header>
    {!loading&&support.reason?<p className={styles.warning} role="status">{support.reason}. Customer records remain confidential.</p>:null}
    {!loading&&!support.reason&&!cases.length?<p>No customer cases currently visible.</p>:null}
    {!loading&&cases.slice(0,12).map(c=><div key={c.id} className={styles.ticket}>
     <span><strong>{c.subject}</strong><small>{c.case_code} · {c.priority} · {c.status}</small></span>
     <Link href="/office/support">Manage in source</Link></div>)}
    <Link href="/office/support" className={styles.source}>Open governed Customer Support <ArrowRight size={15}/></Link>
   </section>
  </div>
  <nav className={styles.quick} aria-label="Support workflow navigation">
   <Link href="/office/chat/support/mine">My IT tickets</Link>
   <Link href="/office/chat/support/assigned">Assigned IT tickets</Link>
   <Link href="/office/chat/support/escalations">Escalations</Link>
   <Link href="/office/chat/support/knowledge">Knowledge Hub</Link>
  </nav>
  <p className={styles.note}><ShieldCheck size={16}/>Ticket resolution, refunds, outward replies and application access remain controlled by their original authoritative services.</p>
 </section>;
}
