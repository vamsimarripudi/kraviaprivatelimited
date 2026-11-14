"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, CheckCircle2, ClipboardCheck, Headphones, MessageCircle, Plus, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import styles from "./office-connect-overview.module.css";
import { useOfficeWorkspace } from "@/components/office-workspace-context";

type Conversation = { id: string; kind: string; title: string; department_code?: string | null; updated_at: string };
type Work = {
 approvals: Array<{ request: { id: string; title: string; priority: string; status: string } | null }>;
};
type IT = {
 actor: { user_id: string };
 tickets: Array<{ id: string; owner_user_id?: string | null; title: string; status: string; priority: string; due_at?: string | null }>;
};
type Escalations = {
 actor_user_id: string;
 items: Array<{ id: string; recipient_user_id: string; status: string; level: number; source_ticket?: { title?: string } | null }>;
};
type Unread = {
 unread_messages: number;
 unread_conversations: number;
};
type SourceResult<T> = { value?: T; state: "ok" | "restricted" | "unavailable" };

async function readSource<T>(path: string): Promise<SourceResult<T>> {
 try {
  const response = await fetch(path, { cache: "no-store", credentials: "same-origin" });
  if (response.status === 401 || response.status === 403) return { state: "restricted" };
  const body = await response.json().catch(() => ({})) as T;
  if (!response.ok) return { state: "unavailable" };
  return { state: "ok", value: body };
 } catch {
  return { state: "unavailable" };
 }
}
function displayCount(result: SourceResult<unknown>, value: number) {
 return result.state === "ok" ? value.toLocaleString("en-IN") : "—";
}
function when(value: string) {
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "Date unavailable";
 return new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
 }).format(date);
}

export function OfficeConnectOverview({ conversations, conversationsLoading, conversationsError }: {
  conversations: Conversation[];
  conversationsLoading: boolean;
  conversationsError: string;
}) {
 const { permissions } = useOfficeWorkspace();
 const [work, setWork] = useState<SourceResult<Work>>({ state: "unavailable" });
 const [it, setIt] = useState<SourceResult<IT>>({ state: "unavailable" });
 const [escalations, setEscalations] = useState<SourceResult<Escalations>>({ state: "unavailable" });
 const [unread, setUnread] = useState<SourceResult<Unread>>({ state: "unavailable" });
 const [loading, setLoading] = useState(true);
 const [refresh, setRefresh] = useState(0);

 useEffect(() => {
  let active = true;
  void Promise.all([
   readSource<Work>("/api/office-work/overview"),
   readSource<IT>("/api/office-it"),
   readSource<Escalations>("/api/office-chat/support/escalations"),
   readSource<Unread>("/api/office-chat/unread"),
  ]).then(([workResult, itResult, escalationResult, unreadResult]) => {
   if (!active) return;
   setWork(workResult);
   setIt(itResult);
   setEscalations(escalationResult);
   setUnread(unreadResult);
  }).finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
 }, [refresh]);

 const pendingApprovals = work.value?.approvals.filter(approval => approval.request) ?? [];
 const assigned = it.value?.tickets.filter(ticket => ticket.owner_user_id === it.value?.actor.user_id
  && !["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.status)) ?? [];
 const attention = escalations.value?.items.filter(item => item.recipient_user_id === escalations.value?.actor_user_id
  && item.status === "PENDING") ?? [];
 const metrics = [
  { label: "Unread messages", value: displayCount(unread, unread.value?.unread_messages ?? 0),
    detail: unread.state === "ok" ? (unread.value?.unread_conversations ?? 0) + " conversations" : "Source " + unread.state },
  { label: "Assigned IT tickets", value: displayCount(it, assigned.length),
    detail: it.state === "ok" ? "Active assigned work" : "Source " + it.state },
  { label: "Pending approvals", value: displayCount(work, pendingApprovals.length),
    detail: work.state === "ok" ? "Canonical approval inbox" : "Source " + work.state },
  { label: "Escalation alerts", value: displayCount(escalations, attention.length),
    detail: escalations.state === "ok" ? "Assigned to your identity" : "Source " + escalations.state },
 ];

 return <div className={styles.overview} aria-label="Communication home overview">
  <div className={styles.actions}>
   <Link href="/office/chat/directory"><Plus size={17} aria-hidden="true"/>New message</Link>
{permissions.includes("it.service.request")?<Link href="/office/chat/support/new"><Headphones size={17} aria-hidden="true"/>New IT ticket</Link>:null}
   <button type="button" onClick={() => {setLoading(true);setRefresh(count => count + 1);}}
    disabled={loading} aria-label="Refresh communication overview">
    <RefreshCw size={17} aria-hidden="true"/>{loading ? "Loading…" : "Refresh"}
   </button>
  </div>
  <p className={styles.policy}><ShieldCheck size={16} aria-hidden="true"/>
   All figures are limited to your current authorized sources. Unavailable or restricted sources never display invented zeroes.
  </p>
  <div className={styles.metrics} aria-busy={loading}>
   {metrics.map(metric => <article key={metric.label}>
    <h2>{metric.label}</h2>
    <strong>{loading ? "…" : metric.value}</strong>
    <small>{loading ? "Resolving permissions…" : metric.detail}</small>
   </article>)}
  </div>
  <div className={styles.columns}>
   <section className={styles.panel} aria-labelledby="connect-recent-title">
    <header><h2 id="connect-recent-title">Recent conversations</h2><Link href="/office/chat/directory">Find colleagues <ArrowRight size={15}/></Link></header>
    {conversationsLoading
     ? <p className={styles.empty} role="status">Loading permitted conversations…</p>
     : conversationsError
     ? <p className={styles.empty}>Conversation list is unavailable. Use Refresh to retry.</p>
     : conversations.length === 0
     ? <div className={styles.empty}><MessageCircle size={21} aria-hidden="true"/>No authorized conversations yet.</div>
     : <div className={styles.rows}>
      {conversations.slice(0,5).map(row => <Link key={row.id}
       href={row.kind==="DEPARTMENT" && row.department_code
         ? "/office/chat/channels/" + encodeURIComponent(row.department_code.toLowerCase())
         : (row.kind==="GROUP" ? "/office/chat/groups/" : "/office/chat/dm/") + row.id}>
       <MessageCircle size={18} aria-hidden="true"/>
       <span><strong>{row.title}</strong><small>{row.kind==="DM"?"Private conversation":row.kind==="GROUP"?"Member group":"Department"} · {when(row.updated_at)}</small></span>
       <ArrowRight size={15} aria-hidden="true"/>
      </Link>)}
     </div>}
   </section>
   <section className={styles.panel} aria-labelledby="connect-attention-title">
    <header><h2 id="connect-attention-title">Needs attention</h2><Link href="/office/chat/activity">Activity <ArrowRight size={15}/></Link></header>
    {loading ? <p role="status">Loading your authorized work…</p> : null}
    {!loading && work.state !== "ok" && escalations.state !== "ok"
     ? <p className={styles.empty}>Approval and escalation sources are not available to this session.</p> : null}
    {!loading && pendingApprovals.length === 0 && attention.length === 0
      && (work.state === "ok" || escalations.state === "ok")
     ? <p className={styles.empty}>No pending actions from the available sources.</p> : null}
    {!loading ? <div className={styles.rows}>
     {attention.slice(0,3).map(item => <Link key={item.id} href={"/office/chat/support/escalations/" + item.id}>
      <TriangleAlert size={18} aria-hidden="true"/>
      <span><strong>{item.source_ticket?.title ?? "IT ticket escalation"}</strong>
       <small>Level {item.level} · awaiting your acknowledgement</small></span>
      <ArrowRight size={15} aria-hidden="true"/></Link>)}
     {pendingApprovals.slice(0,3).map(item => item.request ? <Link key={item.request.id}
      href={"/office/chat/approvals/" + item.request.id}>
      <ClipboardCheck size={18} aria-hidden="true"/>
      <span><strong>{item.request.title}</strong><small>{item.request.priority} · formal workflow decision</small></span>
      <ArrowRight size={15} aria-hidden="true"/></Link> : null)}
    </div> : null}
   </section>
  </div>
  <div className={styles.columns}>
   <section className={styles.panel} aria-labelledby="connect-assigned-title">
    <header><h2 id="connect-assigned-title">Assigned work</h2><Link href="/office/chat/support/assigned">All assigned <ArrowRight size={15}/></Link></header>
    {loading ? <p role="status">Loading source assignments…</p>
      : it.state !== "ok" ? <p className={styles.empty}>IT assignments are not available.</p>
      : assigned.length === 0 ? <p className={styles.empty}>No currently assigned IT tickets.</p>
      : <div className={styles.rows}>
       {assigned.slice(0,4).map(ticket => <Link key={ticket.id} href={"/office/chat/support/tickets/" + ticket.id}>
        <Headphones size={18} aria-hidden="true"/><span><strong>{ticket.title}</strong>
         <small>{ticket.priority} · {ticket.status}</small></span><ArrowRight size={15} aria-hidden="true"/>
       </Link>)}
      </div>}
   </section>
   <section className={styles.panel} aria-labelledby="connect-controls-title">
    <header><h2 id="connect-controls-title">Workspaces & controls</h2><ShieldCheck size={19} aria-hidden="true"/></header>
    <nav className={styles.shortcuts} aria-label="Communication tools">
     <Link href="/office/chat/mentions"><BellRing size={18}/>Mentions</Link>
     <Link href="/office/chat/search"><MessageCircle size={18}/>Search messages</Link>
     <Link href="/office/chat/support"><Headphones size={18}/>Support</Link>
     <Link href="/office/chat/approvals"><ClipboardCheck size={18}/>Approvals</Link>
    </nav>
    <p className={styles.hint}><CheckCircle2 size={16} aria-hidden="true"/>
     Messages remain separate from formal approvals and financial execution.</p>
   </section>
  </div>
 </div>;
}
