"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Filter, RefreshCw, ShieldCheck } from "lucide-react";
import styles from "./office-vault-activity.module.css";

type EventRow = {
 id: number; event_type: string; category_slug: string; resource_id: string | null; occurred_at: string;
};
type Activity = { scope: "OWN"; generated_at: string; events: EventRow[] };
const names: Record<string, string> = {
 identity:"Company identity", registrations:"Registrations", banking:"Banking",
 legal:"Legal", people:"People", technology:"Technology", documents:"Documents", custody:"Secure custody",
};
function readable(text: string) {
 return text.replaceAll("_"," ").toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
}
function date(text: string) {
 const value = new Date(text);
 return Number.isNaN(value.getTime()) ? "Unknown date"
  : new Intl.DateTimeFormat("en-IN", { dateStyle:"medium", timeStyle:"short", timeZone:"Asia/Kolkata" }).format(value);
}
export function OfficeVaultActivity() {
 const [events,setEvents] = useState<EventRow[]>([]);
 const [error,setError] = useState("");
 const [loading,setLoading] = useState(true);
 const [refresh,setRefresh] = useState(0);
 const [category,setCategory] = useState("all");
 const [query,setQuery] = useState("");
 useEffect(() => {
  let live = true;
  void (async () => {
   try {
    const response = await fetch("/api/office-vault/activity", { credentials:"same-origin", cache:"no-store" });
    const data = await response.json().catch(() => ({})) as Activity & {detail?:string};
    if (!response.ok) throw new Error(data.detail ?? "Vault activity unavailable");
    if (data.scope !== "OWN" || !Array.isArray(data.events)) throw new Error("Unexpected activity scope");
    if (live) {setEvents(data.events);setError("");}
   } catch (e) {
    if (live) {setEvents([]);setError(e instanceof Error ? e.message : "Activity unavailable");}
   } finally { if (live) setLoading(false); }
  })();
  return () => {live=false;};
 },[refresh]);
 const categories=useMemo(()=>["all",...new Set(events.map(x=>x.category_slug))],[events]);
 const rows=useMemo(()=>{
  const needle=query.trim().toLowerCase();
  return events.filter(e=>(category==="all"||e.category_slug===category)
   &&(!needle||(e.category_slug+" "+e.event_type).toLowerCase().includes(needle)));
 },[events,category,query]);
 return <section className={styles.shell} aria-label="My Vault access audit">
  <header className={styles.heading}><div><p>PRIVATE AUDIT HISTORY</p>
   <h2>My Vault activity</h2>
   <span>Only access events attributed to your verified Office identity are returned. Record identifiers and other employees' activities are not exposed.</span>
  </div><button type="button" disabled={loading} onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>
   <RefreshCw size={17} aria-hidden="true"/>{loading?"Loading…":"Refresh"}
  </button></header>
  <form className={styles.filters} onSubmit={event=>event.preventDefault()}>
   <label><Filter size={16} aria-hidden="true"/>Category
    <select value={category} onChange={event=>setCategory(event.target.value)}>
     {categories.map(value=><option key={value} value={value}>
      {value==="all"?"All visible categories":names[value]??readable(value)}</option>)}
    </select></label>
   <label>Find event<input value={query} onChange={event=>setQuery(event.target.value)}
    placeholder="Approval, revocation, read…" maxLength={80}/></label>
  </form>
  {loading?<p className={styles.state} role="status" aria-busy="true">Loading your private audit history…</p>:null}
  {error?<div className={styles.error} role="alert"><p>{error}</p>
   <button type="button" onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>Retry</button></div>:null}
  {!loading&&!error&&!rows.length?<p className={styles.state} role="status">
   {events.length===0?"No Vault access events are recorded for this identity.":"No events match these filters."}</p>:null}
  {!loading&&!error? <ol className={styles.events}>
   {rows.map(item=><li key={item.id}><ShieldCheck size={19} aria-hidden="true"/>
    <div><strong>{readable(item.event_type)}</strong>
     <span>{names[item.category_slug]??readable(item.category_slug)} · {item.resource_id?"Specific record":"Category-level action"}</span>
    </div><time dateTime={item.occurred_at}><Clock3 size={14} aria-hidden="true"/>{date(item.occurred_at)}</time>
   </li>)}</ol>:null}
  <footer className={styles.footer}><p>Showing up to 100 most recent events from your own governed access history.</p>
   <Link href="/office/k-vault/requests">View access requests <ArrowRight size={16} aria-hidden="true"/></Link></footer>
 </section>;
}
