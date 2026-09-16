"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, LoaderCircle, UsersRound } from "lucide-react";
import styles from "./office-organization-chart.module.css";

type Person = {
  user_id: string;
  position_code: string;
  department_code: string;
  reports_to_user_id?: string | null;
  team_key?: string | null;
  product_key?: string | null;
  employment_type?: string | null;
  identity?: { display_name?: string | null; job_title?: string | null; primary_department?: string | null; status?: string | null } | null;
  position?: { label?: string | null; family?: string | null; level?: number | null; is_manager?: boolean | null } | null;
};
type Organization = { viewer: string; people: Person[] };

async function load(): Promise<Organization> {
  const response = await fetch("/api/office-organization", { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Unable to load organization");
  return body as Organization;
}

export function OfficeOrganizationChart() {
  const [state, setState] = useState<Organization>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    void load().then((data) => { if (active) setState(data); }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load organization"); });
    return () => { active = false; };
  }, []);

  const filteredIds = useMemo(() => {
    if (!state) return new Set<string>();
    const needle = query.trim().toLowerCase();
    if (!needle) return new Set(state.people.map((person) => person.user_id));
    const direct = state.people.filter((person) => `${person.identity?.display_name ?? ""} ${person.identity?.job_title ?? ""} ${person.position?.label ?? person.position_code} ${person.department_code} ${person.team_key ?? ""}`.toLowerCase().includes(needle));
    const ids = new Set(direct.map((person) => person.user_id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const person of state.people) {
        if (ids.has(person.user_id) && person.reports_to_user_id && !ids.has(person.reports_to_user_id)) { ids.add(person.reports_to_user_id); changed = true; }
      }
    }
    return ids;
  }, [query, state]);

  if (error) return <section className={styles.state}><AlertTriangle /><div><h2>Organization directory unavailable</h2><p>{error}</p></div></section>;
  if (!state) return <section className={styles.state}><LoaderCircle className="spin" /><div><h2>Resolving reporting lines</h2><p>Reading governed position and manager assignments.</p></div></section>;

  const byManager = new Map<string, Person[]>();
  for (const person of state.people) {
    const key = person.reports_to_user_id ?? "ROOT";
    const rows = byManager.get(key) ?? [];
    rows.push(person);
    byManager.set(key, rows);
  }
  const known = new Set(state.people.map((person) => person.user_id));
  const roots = state.people.filter((person) => !person.reports_to_user_id || !known.has(person.reports_to_user_id));
  const departments = new Set(state.people.map((person) => person.department_code)).size;

  return <section className={styles.shell}>
    <header className={styles.hero}><div><p className="eyebrow">GOVERNED ORGANIZATION</p><h2>Reporting lines are data, not assumptions.</h2><p>Only basic workforce directory fields are shown here. Sensitive HR records stay outside the organization chart.</p></div><div><article><UsersRound /><span>Active people</span><b>{state.people.length}</b></article><article><Building2 /><span>Departments</span><b>{departments}</b></article></div></header>
    <div className={styles.toolbar}><label><span>Search organization</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, title, department or team" /></label></div>
    <div className={styles.tree}>{roots.map((person) => <OrgNode key={person.user_id} person={person} byManager={byManager} visible={filteredIds} viewer={state.viewer} />)}{!roots.length ? <p className={styles.empty}>No active job assignments are available.</p> : null}</div>
  </section>;
}

function OrgNode({ person, byManager, visible, viewer }: { person: Person; byManager: Map<string, Person[]>; visible: Set<string>; viewer: string }) {
  if (!visible.has(person.user_id)) return null;
  const children = (byManager.get(person.user_id) ?? []).filter((child) => visible.has(child.user_id));
  return <div className={styles.nodeWrap}>
    <article className={styles.node} data-self={person.user_id === viewer}><div className={styles.avatar}>{(person.identity?.display_name || person.position?.label || "K").slice(0, 2).toUpperCase()}</div><div><b>{person.identity?.display_name || "KRAVIA member"}</b><span>{person.identity?.job_title || person.position?.label || person.position_code.replaceAll("_", " ")}</span><small>{person.department_code}{person.team_key ? ` · ${person.team_key}` : ""}{person.product_key ? ` · ${person.product_key}` : ""}</small></div><em>{person.employment_type || "EMPLOYEE"}</em></article>
    {children.length ? <div className={styles.children}>{children.map((child) => <OrgNode key={child.user_id} person={child} byManager={byManager} visible={visible} viewer={viewer} />)}</div> : null}
  </div>;
}
