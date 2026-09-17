"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, LoaderCircle, Plus, Search, ShieldCheck, X } from "lucide-react";
import styles from "./office-company-inbox.module.css";

type TaskStatus = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
type Task = {
  id: string;
  task_code: string;
  title: string;
  description: string;
  task_type: string;
  priority: string;
  status: TaskStatus;
  assigned_user_id: string;
  created_by: string;
  department_code?: string | null;
  source_type?: string | null;
  source_key?: string | null;
  due_at?: string | null;
  blocked_reason?: string | null;
  created_at: string;
  updated_at: string;
};

type Person = { user_id: string; display_name?: string | null; job_title?: string | null; primary_department?: string | null; status: string };
type Inbox = { actor: { user_id: string; roles: string[] }; assignable_people: Person[]; tasks: Task[] };
type Draft = { assignee: string; title: string; description: string; taskType: string; priority: string; department: string; dueAt: string };
const emptyDraft: Draft = { assignee: "", title: "", description: "", taskType: "GENERAL", priority: "NORMAL", department: "", dueAt: "" };

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Company Inbox request failed");
  return body as T;
}

function readableDate(value?: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function OfficeCompanyInbox({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Inbox>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [blocking, setBlocking] = useState<{ task: Task; note: string }>();

  async function reload(message?: string) {
    const next = await json<Inbox>("/api/office-tasks");
    setData(next);
    setNotice(message);
  }

  useEffect(() => {
    let alive = true;
    void json<Inbox>("/api/office-tasks").then((next) => { if (alive) setData(next); }).catch((caught: unknown) => {
      if (alive) setError(caught instanceof Error ? caught.message : "Unable to load Company Inbox");
    });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const rows = data?.tasks ?? [];
    const needle = search.trim().toLowerCase();
    const visible = compact ? rows.filter((task) => !["DONE", "CANCELLED"].includes(task.status)).slice(0, 8) : rows;
    if (!needle) return visible;
    return visible.filter((task) => `${task.task_code} ${task.title} ${task.description} ${task.task_type} ${task.priority} ${task.status}`.toLowerCase().includes(needle));
  }, [compact, data?.tasks, search]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.assignee) return;
    setBusy("create");
    setError(undefined);
    try {
      await json("/api/office-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignee_user_id: draft.assignee,
          title: draft.title,
          description: draft.description || undefined,
          task_type: draft.taskType,
          priority: draft.priority,
          department: draft.department || undefined,
          due_at: draft.dueAt ? new Date(draft.dueAt).toISOString() : undefined,
        }),
      });
      setDraft(emptyDraft);
      setNewOpen(false);
      await reload("Task created in the Company Inbox.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create task");
    } finally {
      setBusy(undefined);
    }
  }

  async function transition(task: Task, action: "START" | "BLOCK" | "COMPLETE" | "REOPEN" | "CANCEL", note?: string) {
    setBusy(task.id);
    setError(undefined);
    try {
      await json(`/api/office-tasks/${task.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      setBlocking(undefined);
      await reload(`Task ${label(action).toLowerCase()} recorded.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update task");
    } finally {
      setBusy(undefined);
    }
  }

  const active = (data?.tasks ?? []).filter((task) => ["OPEN", "IN_PROGRESS", "BLOCKED"].includes(task.status));
  const blocked = active.filter((task) => task.status === "BLOCKED").length;
  const inProgress = active.filter((task) => task.status === "IN_PROGRESS").length;

  if (error && !data) return <section className={styles.state}><AlertTriangle /><div><h2>Company Inbox unavailable</h2><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className="spin" /><div><h2>Opening Company Inbox</h2><p>Resolving assigned work and reporting authority.</p></div></section>;

  return <section className={styles.shell} data-compact={compact}>
    <header className={styles.hero}>
      <div><p>COMPANY INBOX</p><h2>{compact ? "Actionable work across KRAVIA." : "One task queue across the company."}</h2><span>Tasks are separate from approvals: they coordinate execution after authority is established.</span></div>
      <button className={styles.primary} type="button" onClick={() => { setDraft((current) => ({ ...current, assignee: current.assignee || data.actor.user_id })); setNewOpen(true); }}><Plus /> New task</button>
    </header>

    <div className={styles.metrics}>
      <article><span>Active</span><strong>{active.length}</strong><small>Open, in progress or blocked</small></article>
      <article><span>In progress</span><strong>{inProgress}</strong><small>Currently being worked</small></article>
      <article><span>Blocked</span><strong>{blocked}</strong><small>Needs an explicit unblock</small></article>
      <article><span>Assignable people</span><strong>{data.assignable_people.length}</strong><small>Based on authority and reporting line</small></article>
    </div>

    {notice ? <div className={styles.notice}><ShieldCheck />{notice}<button type="button" aria-label="Dismiss" onClick={() => setNotice(undefined)}><X /></button></div> : null}
    {error ? <div className={styles.error}><AlertTriangle />{error}</div> : null}

    {!compact ? <div className={styles.toolbar}><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks, codes, types or status" /></label></div> : null}

    <div className={styles.list}>{filtered.length ? filtered.map((task) => <article className={styles.task} key={task.id} data-status={task.status}>
      <div className={styles.taskStatus}>{task.status === "DONE" ? <CheckCircle2 /> : task.status === "IN_PROGRESS" ? <Clock3 /> : <CircleDashed />}</div>
      <div className={styles.taskBody}><div className={styles.taskTop}><div><code>{task.task_code}</code><b>{task.title}</b></div><span data-priority={task.priority}>{task.priority}</span></div><p>{task.description || "No additional description."}</p><div className={styles.meta}><span>{label(task.task_type)}</span><span>{label(task.status)}</span><span>{readableDate(task.due_at)}</span>{task.department_code ? <span>{task.department_code}</span> : null}</div>{task.blocked_reason ? <div className={styles.blockedReason}><AlertTriangle />{task.blocked_reason}</div> : null}</div>
      <div className={styles.actions}>{task.status === "OPEN" ? <button type="button" disabled={busy === task.id} onClick={() => void transition(task, "START")}>Start</button> : null}{["OPEN", "IN_PROGRESS"].includes(task.status) ? <button type="button" disabled={busy === task.id} onClick={() => setBlocking({ task, note: "" })}>Block</button> : null}{["OPEN", "IN_PROGRESS", "BLOCKED"].includes(task.status) ? <button className={styles.complete} type="button" disabled={busy === task.id} onClick={() => void transition(task, "COMPLETE")}>{busy === task.id ? <LoaderCircle className="spin" /> : null} Complete</button> : null}{["DONE", "CANCELLED", "BLOCKED"].includes(task.status) ? <button type="button" disabled={busy === task.id} onClick={() => void transition(task, "REOPEN")}>Reopen</button> : null}</div>
    </article>) : <div className={styles.empty}>No tasks match this view.</div>}</div>

    {compact && (data.tasks.length > filtered.length || data.tasks.some((task) => ["DONE", "CANCELLED"].includes(task.status))) ? <Link className={styles.openAll} href="/office/tasks">Open full Company Inbox →</Link> : null}

    {newOpen ? <div className={styles.backdrop} role="presentation" onMouseDown={() => setNewOpen(false)}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label="Create task" onMouseDown={(event) => event.stopPropagation()}><header><div><p>NEW TASK</p><h2>Create actionable work</h2></div><button type="button" onClick={() => setNewOpen(false)} aria-label="Close"><X /></button></header><form onSubmit={submit}>
      <label>Assignee<select required value={draft.assignee} onChange={(event) => setDraft((current) => ({ ...current, assignee: event.target.value }))}><option value="">Choose person</option>{data.assignable_people.map((person) => <option key={person.user_id} value={person.user_id}>{person.display_name || person.job_title || person.user_id}</option>)}</select></label>
      <label>Task title<input required minLength={3} maxLength={180} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="What must be completed?" /></label>
      <label>Description<textarea rows={4} maxLength={4000} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Outcome, context and acceptance notes" /></label>
      <div className={styles.formGrid}><label>Task type<select value={draft.taskType} onChange={(event) => setDraft((current) => ({ ...current, taskType: event.target.value }))}>{["GENERAL","REQUEST","COMPLIANCE","INCIDENT","SALES","ENGINEERING","PEOPLE","FINANCE","LEGAL","OPERATIONS","PRODUCT"].map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label><label>Priority<select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}>{["LOW","NORMAL","HIGH","URGENT"].map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}</select></label></div>
      <div className={styles.formGrid}><label>Department<input maxLength={80} value={draft.department} onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))} placeholder="Optional" /></label><label>Due date/time<input type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft((current) => ({ ...current, dueAt: event.target.value }))} /></label></div>
      <div className={styles.guard}><ShieldCheck /><p>Creating a task does not grant permission or approve a regulated action. Authority remains in the approval and permission engines.</p></div>
      <button className={styles.submit} type="submit" disabled={busy === "create"}>{busy === "create" ? <LoaderCircle className="spin" /> : <Plus />} Create task</button>
    </form></aside></div> : null}

    {blocking ? <div className={styles.backdrop} role="presentation" onMouseDown={() => setBlocking(undefined)}><section className={styles.blockModal} role="dialog" aria-modal="true" aria-label="Block task" onMouseDown={(event) => event.stopPropagation()}><header><div><p>BLOCK TASK</p><h2>{blocking.task.title}</h2></div><button type="button" onClick={() => setBlocking(undefined)} aria-label="Close"><X /></button></header><label>Blocking reason<textarea rows={4} minLength={3} maxLength={2000} value={blocking.note} onChange={(event) => setBlocking({ ...blocking, note: event.target.value })} placeholder="What dependency or decision is preventing progress?" /></label><button className={styles.blockButton} type="button" disabled={blocking.note.trim().length < 3 || busy === blocking.task.id} onClick={() => void transition(blocking.task, "BLOCK", blocking.note)}>Record blocker</button></section></div> : null}
  </section>;
}
