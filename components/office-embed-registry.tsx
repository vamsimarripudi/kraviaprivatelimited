"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, LoaderCircle, Plus, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";
import { EnterpriseCombobox } from "@/components/enterprise-combobox";
import { SecureEmbedFrame } from "@/components/secure-embed-frame";
import styles from "./office-embed-registry.module.css";

type Embed = { id: string; code: string; title: string; description?: string | null; url: string; allowed_host: string; required_permission: string; status: "ACTIVE" | "DISABLED"; updated_at: string };
type Permission = { code: string; label: string; module: string };
type State = { can_manage: boolean; embeds: Embed[]; permission_options: Permission[] };
type Draft = { code: string; title: string; description: string; url: string; allowedHost: string; permission: string };
const emptyDraft: Draft = { code: "", title: "", description: "", url: "", allowedHost: "", permission: "integration.embed.view" };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Embedded workspace request failed");
  return body as T;
}

export function OfficeEmbedRegistry() {
  const [state, setState] = useState<State>();
  const [selected, setSelected] = useState<string>();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function reload() {
    const next = await json<State>("/api/office-embeds");
    setState(next);
    setSelected((current) => current && next.embeds.some((embed) => embed.code === current) ? current : next.embeds.find((embed) => embed.status === "ACTIVE")?.code);
  }

  useEffect(() => { let active = true; void json<State>("/api/office-embeds").then((next) => { if (active) { setState(next); setSelected(next.embeds.find((embed) => embed.status === "ACTIVE")?.code); } }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load embedded workspaces"); }); return () => { active = false; }; }, []);

  const current = state?.embeds.find((embed) => embed.code === selected && embed.status === "ACTIVE");
  const permissionOptions = useMemo(() => (state?.permission_options ?? []).map((permission) => ({ value: permission.code, label: permission.label, meta: permission.module })), [state?.permission_options]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(undefined);
    try {
      await json("/api/office-embeds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "UPSERT", code: draft.code, title: draft.title, description: draft.description || undefined, url: draft.url, allowed_host: draft.allowedHost, required_permission: draft.permission, status: "ACTIVE" }) });
      setDraft(emptyDraft); await reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save embedded workspace"); } finally { setBusy(false); }
  }

  async function toggle(embed: Embed) {
    setBusy(true); setError(undefined);
    try { await json("/api/office-embeds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "STATUS", code: embed.code, status: embed.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }) }); await reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update embedded workspace"); }
    finally { setBusy(false); }
  }

  if (!state && !error) return <section className={styles.state}><LoaderCircle className="spin" /><div><h2>Loading governed embeds</h2><p>Resolving permission-scoped workspace integrations.</p></div></section>;
  if (!state) return <section className={styles.state}><ShieldCheck /><div><h2>Embedded workspaces unavailable</h2><p>{error}</p></div></section>;

  return <div className={styles.shell}>
    <section className={styles.hero}><div><p className="eyebrow">SECURE EMBED REGISTRY</p><h2>One Office surface, explicit framing boundaries.</h2><p>Only approved HTTPS destinations with an exact host match can render here. External systems that block framing remain deep-link only.</p></div><ShieldCheck /></section>
    {error ? <div className={styles.error}>{error}</div> : null}
    <div className={styles.layout}>
      <aside className={styles.catalog}><header><div><p className="eyebrow">WORKSPACES</p><h3>Approved embeds</h3></div><span>{state.embeds.length}</span></header>{state.embeds.map((embed) => <article key={embed.code} data-selected={embed.code === selected}><button type="button" onClick={() => embed.status === "ACTIVE" && setSelected(embed.code)}><b>{embed.title}</b><span>{embed.allowed_host}</span><small>{embed.required_permission}</small></button><em data-status={embed.status}>{embed.status}</em>{state.can_manage ? <button className={styles.toggle} type="button" disabled={busy} onClick={() => void toggle(embed)} aria-label={`${embed.status === "ACTIVE" ? "Disable" : "Enable"} ${embed.title}`}>{embed.status === "ACTIVE" ? <ToggleRight /> : <ToggleLeft />}</button> : null}</article>)}{!state.embeds.length ? <div className={styles.empty}>No embedded workspace is approved for your current permissions.</div> : null}</aside>
      <section className={styles.viewer}>{current ? <><div className={styles.viewerHead}><div><b>{current.title}</b><span>{current.description || "Governed embedded workspace"}</span></div><a href={current.url} target="_blank" rel="noreferrer"><ExternalLink /> Open externally</a></div><SecureEmbedFrame title={current.title} src={current.url} allowedHosts={[current.allowed_host]} /></> : <div className={styles.viewerEmpty}><ShieldCheck /><div><b>Select an active approved workspace</b><p>The iframe is created only after the server confirms the registry entry and your current permission.</p></div></div>}</section>
    </div>
    {state.can_manage ? <section className={styles.manage}><header><div><p className="eyebrow">OWNER / DELEGATED INTEGRATION CONTROL</p><h3>Approve embedded workspace</h3></div><Plus /></header><form onSubmit={save}><label>Code<input required pattern="[A-Za-z0-9_]{2,80}" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} placeholder="ENGINEERING_DASH" /></label><label>Title<input required minLength={2} maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label className={styles.wide}>Description<input maxLength={600} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label className={styles.wide}>HTTPS URL<input required type="url" value={draft.url} onChange={(event) => { const url = event.target.value; let host = draft.allowedHost; try { host = new URL(url).hostname; } catch {} setDraft({ ...draft, url, allowedHost: host }); }} placeholder="https://internal.example.com/dashboard" /></label><label>Allowed host<input required value={draft.allowedHost} onChange={(event) => setDraft({ ...draft, allowedHost: event.target.value })} /></label><div><EnterpriseCombobox label="Required permission" value={draft.permission} options={permissionOptions} onChange={(permission) => setDraft({ ...draft, permission })} /></div><button type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Plus />} Approve embed</button></form></section> : null}
  </div>;
}
