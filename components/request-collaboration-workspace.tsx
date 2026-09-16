"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AtSign, LoaderCircle, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import { EnterpriseCombobox } from "@/components/enterprise-combobox";
import styles from "./request-collaboration-workspace.module.css";

type WorkRequest = { id: string; title: string; status: string; request_type_code: string; resource_key?: string | null };
type Approval = { request: WorkRequest | null };
type Overview = { requests: WorkRequest[]; team_requests: WorkRequest[]; approvals: Approval[] };
type Comment = { id: string; author_user_id: string; body: string; created_at: string; author?: { display_name?: string | null; job_title?: string | null; primary_department?: string | null } | null };
type CommentResponse = { request_id: string; comments: Comment[] };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Collaboration request failed");
  return body as T;
}

function time(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function RequestCollaborationWorkspace() {
  const [requests, setRequests] = useState<WorkRequest[]>([]);
  const [selected, setSelected] = useState<string>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void json<Overview>("/api/office-work/overview").then((overview) => {
      if (!active) return;
      const rows = [...overview.requests, ...overview.team_requests, ...overview.approvals.map((item) => item.request).filter((item): item is WorkRequest => Boolean(item))];
      const unique = Array.from(new Map(rows.map((row) => [row.id, row])).values());
      setRequests(unique);
      setSelected((current) => current ?? unique[0]?.id);
    }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load collaboration requests"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    void json<CommentResponse>(`/api/office-work/comments?request_id=${encodeURIComponent(selected)}`)
      .then((result) => { if (active) { setComments(result.comments); setError(undefined); } })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load comments"); });
    return () => { active = false; };
  }, [selected]);

  const current = requests.find((request) => request.id === selected);
  const options = useMemo(() => requests.map((request) => ({ value: request.id, label: request.title, meta: `${request.request_type_code.replaceAll("_", " ")} · ${request.status.replaceAll("_", " ")}` })), [requests]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !body.trim()) return;
    setBusy(true);
    try {
      await json("/api/office-work/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: selected, body }) });
      setBody("");
      const result = await json<CommentResponse>(`/api/office-work/comments?request_id=${encodeURIComponent(selected)}`);
      setComments(result.comments);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add comment");
    } finally {
      setBusy(false);
    }
  }

  return <section className={styles.shell}>
    <header className={styles.header}><div><p className="eyebrow">REQUEST COLLABORATION</p><h2>Keep decisions and context attached to the workflow.</h2><span>Comments are immutable request evidence. Mention a KRAVIA work email to notify that participant.</span></div><MessageSquareText aria-hidden="true" /></header>
    <div className={styles.controls}>
      <EnterpriseCombobox label="Request" value={selected} options={options} onChange={setSelected} placeholder="Choose a request" />
      {current ? <div className={styles.requestMeta}><ShieldCheck /><span><b>{current.status.replaceAll("_", " ")}</b><small>{current.resource_key || current.request_type_code.replaceAll("_", " ")}</small></span></div> : null}
    </div>
    {error ? <div className={styles.error} role="status">{error}</div> : null}
    <div className={styles.thread} aria-live="polite">
      {comments.map((comment) => <article key={comment.id}><div className={styles.avatar}>{(comment.author?.display_name || "K").slice(0, 2).toUpperCase()}</div><div><header><b>{comment.author?.display_name || "KRAVIA participant"}</b><span>{comment.author?.job_title || comment.author?.primary_department || "Office user"} · {time(comment.created_at)}</span></header><p>{comment.body}</p></div></article>)}
      {!comments.length ? <div className={styles.empty}><MessageSquareText /><div><b>No collaboration yet</b><p>Add context, questions or handoff notes here instead of moving approval evidence into chat.</p></div></div> : null}
    </div>
    <form className={styles.composer} onSubmit={submit}><div><AtSign /><textarea required minLength={1} maxLength={4000} rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add context or mention a work email…" /></div><button type="submit" disabled={busy || !selected || !body.trim()}>{busy ? <LoaderCircle className="spin" /> : <Send />} Comment</button></form>
  </section>;
}
