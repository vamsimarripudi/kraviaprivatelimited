"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Fingerprint, KeyRound, Laptop, LoaderCircle, Search, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import styles from "./office-security-overview.module.css";

type Person = { user_id: string; display_name?: string | null; job_title?: string | null; primary_department?: string | null; status: string };
type Session = { id: string; user_id: string; status: string; aal: string; mfa_verified: boolean; risk_level: string; ip_address?: string | null; user_agent_summary?: string | null; started_at: string; last_seen_at: string; ended_at?: string | null; end_reason?: string | null };
type Device = { id: string; user_id: string; device_label: string; device_kind: string; platform?: string | null; trust_state: string; company_managed: boolean; last_seen_at?: string | null };
type Incident = { id: string; incident_code: string; severity: string; title: string; summary: string; status: string; owner_user_id: string; started_at: string; resolved_at?: string | null; updated_at: string };
type AuthEvent = { id: number; user_id: string; event_type: string; aal?: string | null; ip_address?: string | null; created_at: string };
type AccessEvent = { id: number; actor_user_id: string; target_user_id?: string | null; target_email?: string | null; action: string; reason?: string | null; created_at: string };
type Payload = { scope: { type?: string | null; key?: string | null }; summary: { active_sessions: number; active_without_aal2: number; elevated_risk_sessions: number; pending_devices: number; trusted_managed_devices: number; open_incidents: number }; people: Person[]; sessions: Session[]; devices: Device[]; auth_events: AuthEvent[]; incidents: Incident[]; access_audit: AccessEvent[]; disclaimer: string };

async function load(): Promise<Payload> {
  const response = await fetch("/api/office-security-overview", { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Security overview unavailable");
  return body as Payload;
}
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()); }
function dateTime(value?: string | null) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(d); }

export function OfficeSecurityOverview() {
  const [data, setData] = useState<Payload>();
  const [error, setError] = useState<string>();
  const [view, setView] = useState<"sessions" | "devices" | "incidents" | "events">("sessions");
  const [query, setQuery] = useState("");
  useEffect(() => { let alive = true; void load().then((next) => { if (alive) setData(next); }).catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Security overview unavailable"); }); return () => { alive = false; }; }, []);
  const people = useMemo(() => new Map((data?.people ?? []).map((person) => [person.user_id, person])), [data?.people]);
  const needle = query.trim().toLowerCase();
  if (error) return <section className={styles.state}><CircleAlert /><div><h2>Security overview unavailable</h2><p>{error}</p></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Loading security overview</h2><p>Resolving scoped authentication, device and incident evidence.</p></div></section>;

  const sessions = data.sessions.filter((item) => !needle || `${item.status} ${item.risk_level} ${item.aal} ${people.get(item.user_id)?.display_name ?? ""} ${item.user_agent_summary ?? ""}`.toLowerCase().includes(needle));
  const devices = data.devices.filter((item) => !needle || `${item.device_label} ${item.platform ?? ""} ${item.trust_state} ${people.get(item.user_id)?.display_name ?? ""}`.toLowerCase().includes(needle));
  const incidents = data.incidents.filter((item) => !needle || `${item.incident_code} ${item.title} ${item.severity} ${item.status}`.toLowerCase().includes(needle));
  const events = data.auth_events.filter((item) => !needle || `${item.event_type} ${item.aal ?? ""} ${people.get(item.user_id)?.display_name ?? ""}`.toLowerCase().includes(needle));

  return <section className={styles.shell}>
    <header className={styles.hero}><div><p>SECURITY OBSERVABILITY</p><h2>Identity, device and incident evidence without employee spyware.</h2><span>{data.disclaimer}</span></div><span className={styles.scope}><ShieldCheck /> {data.scope.type || "OWNER"}{data.scope.key ? ` · ${data.scope.key}` : ""}</span></header>
    <div className={styles.metrics}><article><Fingerprint /><b>{data.summary.active_sessions}</b><span>active sessions</span></article><article data-risk={data.summary.active_without_aal2 > 0}><KeyRound /><b>{data.summary.active_without_aal2}</b><span>without AAL2</span></article><article data-risk={data.summary.elevated_risk_sessions > 0}><ShieldAlert /><b>{data.summary.elevated_risk_sessions}</b><span>elevated risk</span></article><article data-risk={data.summary.pending_devices > 0}><Laptop /><b>{data.summary.pending_devices}</b><span>pending devices</span></article><article><ShieldCheck /><b>{data.summary.trusted_managed_devices}</b><span>trusted managed</span></article><article data-risk={data.summary.open_incidents > 0}><CircleAlert /><b>{data.summary.open_incidents}</b><span>open incidents</span></article></div>
    <div className={styles.toolbar}><div className={styles.tabs}>{(["sessions","devices","incidents","events"] as const).map((key) => <button type="button" key={key} data-active={view === key} onClick={() => setView(key)}>{label(key)}</button>)}</div><label><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter visible security records" /></label></div>

    {view === "sessions" ? <div className={styles.table}>{sessions.map((item) => <article key={item.id}><Users /><div><b>{people.get(item.user_id)?.display_name || people.get(item.user_id)?.job_title || "Office user"}</b><span>{item.user_agent_summary || "Session"} · last seen {dateTime(item.last_seen_at)}</span></div><em data-risk={item.risk_level}>{item.risk_level}</em><code>{item.aal.toUpperCase()} · {item.mfa_verified ? "MFA" : "NO MFA"}</code><strong>{item.status}</strong></article>)}{!sessions.length ? <Empty text="No matching authentication sessions." /> : null}</div> : null}
    {view === "devices" ? <div className={styles.table}>{devices.map((item) => <article key={item.id}><Laptop /><div><b>{item.device_label}</b><span>{item.platform || item.device_kind} · {people.get(item.user_id)?.display_name || "Office user"}</span></div><em>{item.company_managed ? "MANAGED" : "PERSONAL"}</em><code>Last seen {dateTime(item.last_seen_at)}</code><strong>{item.trust_state}</strong></article>)}{!devices.length ? <Empty text="No matching registered devices." /> : null}</div> : null}
    {view === "incidents" ? <div className={styles.table}>{incidents.map((item) => <article key={item.id}><ShieldAlert /><div><b>{item.incident_code} · {item.title}</b><span>{item.summary}</span></div><em data-risk={item.severity}>{item.severity}</em><code>{people.get(item.owner_user_id)?.display_name || "Assigned owner"}</code><strong>{item.status}</strong></article>)}{!incidents.length ? <Empty text="No matching engineering/security incidents." /> : null}</div> : null}
    {view === "events" ? <div className={styles.events}><section><h3>Authentication events</h3>{events.slice(0,100).map((item) => <article key={item.id}><Fingerprint /><div><b>{label(item.event_type)}</b><span>{people.get(item.user_id)?.display_name || "Office user"} · {dateTime(item.created_at)}</span></div><code>{item.aal?.toUpperCase() || "—"}</code></article>)}</section><section><h3>Access-control changes</h3>{data.access_audit.slice(0,100).map((item) => <article key={item.id}><KeyRound /><div><b>{label(item.action)}</b><span>{dateTime(item.created_at)}{item.reason ? ` · ${item.reason}` : ""}</span></div><code>{item.target_email || people.get(item.target_user_id || "")?.display_name || "Scoped target"}</code></article>)}</section></div> : null}
  </section>;
}

function Empty({ text }: { text: string }) { return <div className={styles.empty}><ShieldCheck /><b>No record</b><span>{text}</span></div>; }
