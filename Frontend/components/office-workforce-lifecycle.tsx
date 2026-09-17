"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleAlert, LoaderCircle, LogIn, LogOut, ShieldCheck, UserRoundCheck, UsersRound, X } from "lucide-react";
import styles from "./office-workforce-lifecycle.module.css";

type LifecycleRequest = {
  id: string;
  request_type_code: "EMPLOYEE_ONBOARDING" | "EMPLOYEE_OFFBOARDING";
  title: string;
  status: string;
  current_step_order?: number | null;
  due_at?: string | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

type Person = {
  user_id: string;
  status: string;
  display_name?: string | null;
  job_title?: string | null;
  primary_department?: string | null;
  authorization_version: number;
  job?: {
    position_code: string;
    department_code: string;
    reports_to_user_id?: string | null;
    employment_type: string;
    status: string;
    start_date?: string | null;
    end_date?: string | null;
  } | null;
  lifecycle_requests: LifecycleRequest[];
  can_manage: boolean;
};

type Payload = {
  actor: { user_id: string; roles: string[]; department?: string | null };
  people: Person[];
  can_execute_offboarding: boolean;
  disclaimer: string;
};

type Action = { person: Person; kind: "ONBOARDING" | "OFFBOARDING" | "EXECUTE_OFFBOARDING" };

async function api<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-workforce-lifecycle", { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Workforce lifecycle request failed");
  return body as T;
}

function title(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function latest(person: Person, kind: "EMPLOYEE_ONBOARDING" | "EMPLOYEE_OFFBOARDING") {
  return person.lifecycle_requests.find((request) => request.request_type_code === kind);
}

function readableDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

export function OfficeWorkforceLifecycle() {
  const [data, setData] = useState<Payload>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<Action>();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload(message?: string) {
    const next = await api<Payload>();
    setData(next);
    if (message) setNotice(message);
  }

  useEffect(() => {
    let alive = true;
    void api<Payload>().then((next) => { if (alive) setData(next); }).catch((caught: unknown) => {
      if (alive) setError(caught instanceof Error ? caught.message : "Unable to load workforce lifecycle");
    });
    return () => { alive = false; };
  }, []);

  const people = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data?.people ?? [];
    return (data?.people ?? []).filter((person) => `${person.display_name ?? ""} ${person.job_title ?? ""} ${person.primary_department ?? ""} ${person.status}`.toLowerCase().includes(needle));
  }, [data?.people, query]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || reason.trim().length < 3) return;
    setBusy(true); setError(undefined);
    try {
      if (action.kind === "EXECUTE_OFFBOARDING") {
        const request = latest(action.person, "EMPLOYEE_OFFBOARDING");
        if (!request || request.status !== "APPROVED") throw new Error("An approved offboarding request is required before revocation.");
        await api({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "EXECUTE_OFFBOARDING", target_user_id: action.person.user_id, request_id: request.id, reason: reason.trim() }),
        });
        await reload("Office access revoked after approved offboarding. External provider accounts remain manual controlled follow-up work.");
      } else {
        await api({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "CREATE_LIFECYCLE", target_user_id: action.person.user_id, kind: action.kind, reason: reason.trim() }),
        });
        await reload(`${title(action.kind)} request created. Approval is required before controlled execution.`);
      }
      setAction(undefined); setReason("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update workforce lifecycle");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <section className={styles.state}><CircleAlert /><div><h2>Workforce lifecycle unavailable</h2><p>{error}</p></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Loading workforce lifecycle</h2><p>Resolving people scope and governed joiner/leaver requests.</p></div></section>;

  return <section className={styles.shell} aria-label="Workforce lifecycle">
    <header className={styles.hero}><div><p>JOINER / LEAVER CONTROL</p><h2>Onboarding and offboarding stay approval-led.</h2><span>{data.disclaimer}</span></div><div className={styles.metrics}><article><UsersRound /><b>{data.people.length}</b><span>visible people</span></article><article><ShieldCheck /><b>{data.people.filter((person) => person.status === "ACTIVE").length}</b><span>active identities</span></article></div></header>
    <div className={styles.toolbar}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people, role or department" aria-label="Search workforce lifecycle" /><span>Approval first · execution second · evidence retained</span></div>
    {notice ? <div className={styles.notice}><ShieldCheck />{notice}<button type="button" onClick={() => setNotice(undefined)} aria-label="Dismiss"><X /></button></div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}

    <div className={styles.list}>{people.map((person) => {
      const onboarding = latest(person, "EMPLOYEE_ONBOARDING");
      const offboarding = latest(person, "EMPLOYEE_OFFBOARDING");
      const canStartOnboarding = person.can_manage && ["INVITED", "ACTIVE"].includes(person.status) && !onboarding;
      const canStartOffboarding = person.can_manage && ["ACTIVE", "SUSPENDED"].includes(person.status) && person.user_id !== data.actor.user_id && !offboarding;
      const canExecute = data.can_execute_offboarding && offboarding?.status === "APPROVED" && !["REVOKED"].includes(person.status);
      return <article className={styles.person} key={person.user_id}>
        <div className={styles.personMain}><div className={styles.avatar}>{(person.display_name || person.job_title || "KR").slice(0, 2).toUpperCase()}</div><div><h3>{person.display_name || "KRAVIA member"}</h3><p>{person.job_title || person.job?.position_code || "Position pending"} · {person.primary_department || person.job?.department_code || "Unassigned"}</p><span>{title(person.status)} · access v{person.authorization_version}</span></div></div>
        <div className={styles.flow}>
          <div data-status={onboarding?.status || "NONE"}><LogIn /><span><b>Onboarding</b><small>{onboarding ? `${title(onboarding.status)} · ${readableDate(onboarding.submitted_at || onboarding.created_at)}` : "Not started"}</small></span></div>
          <ArrowRight aria-hidden="true" />
          <div data-status={person.status}><UserRoundCheck /><span><b>Employment access</b><small>{person.job?.employment_type ? title(person.job.employment_type) : "Identity only"}</small></span></div>
          <ArrowRight aria-hidden="true" />
          <div data-status={offboarding?.status || "NONE"}><LogOut /><span><b>Offboarding</b><small>{offboarding ? `${title(offboarding.status)} · ${readableDate(offboarding.submitted_at || offboarding.created_at)}` : "Not started"}</small></span></div>
        </div>
        <div className={styles.actions}>{canStartOnboarding ? <button type="button" onClick={() => { setAction({ person, kind: "ONBOARDING" }); setReason(""); }}><LogIn /> Start onboarding</button> : null}{canStartOffboarding ? <button type="button" onClick={() => { setAction({ person, kind: "OFFBOARDING" }); setReason(""); }}><LogOut /> Start offboarding</button> : null}{canExecute ? <button type="button" className={styles.danger} onClick={() => { setAction({ person, kind: "EXECUTE_OFFBOARDING" }); setReason(""); }}><ShieldCheck /> Revoke Office access</button> : null}</div>
      </article>;
    })}{!people.length ? <div className={styles.empty}><UsersRound /><b>No matching workforce records</b><span>No sample identities are created for presentation.</span></div> : null}</div>

    {action ? <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && setAction(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><header><div><p>{action.kind === "EXECUTE_OFFBOARDING" ? "CONTROLLED EXECUTION" : "GOVERNED REQUEST"}</p><h3>{title(action.kind)} · {action.person.display_name || "KRAVIA member"}</h3></div><button type="button" onClick={() => setAction(undefined)} aria-label="Close" disabled={busy}><X /></button></header><p>{action.kind === "EXECUTE_OFFBOARDING" ? "This revokes KRAVIA Office identity, active role grants, access profiles and registered devices after the approved request. It does not silently delete external provider accounts." : "This creates an approval workflow. It does not directly change employment, access or provider accounts."}</p><label>Business reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={1000} required placeholder="Reason, effective timing and any operational context" /></label><footer><button type="button" onClick={() => setAction(undefined)} disabled={busy}>Cancel</button><button type="submit" disabled={busy || reason.trim().length < 3}>{busy ? <LoaderCircle className={styles.spin} /> : <ShieldCheck />}{action.kind === "EXECUTE_OFFBOARDING" ? "Execute approved revocation" : "Create governed request"}</button></footer></form></div> : null}
  </section>;
}
