"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, ClipboardCheck, LoaderCircle, Mail, Send, ShieldCheck, UserRoundCheck } from "lucide-react";
import type { PublicIntakeQueue, PublicIntakeRecordKind } from "@/lib/office/public-intake-server";
import styles from "./office-public-intake-inbox.module.css";

type Update = { id: string; body: string; customer_visible: boolean; email_delivery_status: "NOT_REQUESTED" | "PENDING" | "SENT" | "FAILED" | "UNKNOWN"; created_at: string };
type Item = {
  id: string; record_kind: PublicIntakeRecordKind; queue: PublicIntakeQueue; reference: string; requester_name: string; requester_email: string;
  organisation?: string | null; category: string; subject: string; description: string; status: string; priority: string;
  office_assigned_to?: string | null; version: number; created_at: string; updated_at: string; updates: Update[];
};
type Payload = { queue: PublicIntakeQueue; can_manage: boolean; scope: { type?: string | null; key?: string | null }; items: Item[]; disclaimer: string };

const titles: Record<PublicIntakeQueue, { eyebrow: string; title: string; empty: string }> = {
  GENERAL: { eyebrow: "PUBLIC CONTACT & SUPPORT", title: "Requests waiting for a real follow-up.", empty: "No public contact or support requests are waiting in your authorised queue." },
  TRUST_DPDPA: { eyebrow: "RESTRICTED PUBLIC REQUESTS", title: "Privacy and Trust requests awaiting review.", empty: "No public Privacy or Trust requests are waiting in your authorised queue." },
  SECURITY_REPORTING: { eyebrow: "RESTRICTED SECURITY REPORTS", title: "Security reports awaiting approved handling.", empty: "No public security reports are waiting in your authorised queue." },
};

function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (part) => part.toUpperCase()); }
function dateTime(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed); }

export function OfficePublicIntakeInbox({ queue }: { queue: PublicIntakeQueue }) {
  const [data, setData] = useState<Payload>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [replying, setReplying] = useState<string>();
  const [reply, setReply] = useState<Record<string, string>>({});
  const copy = titles[queue];

  const reload = useCallback(async () => {
    const response = await fetch(`/api/office-public-intake?queue=${encodeURIComponent(queue)}`, { cache: "no-store", credentials: "same-origin" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Public intake is unavailable");
    setData(body as Payload);
  }, [queue]);
  useEffect(() => { let active = true; void reload().catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Public intake is unavailable"); }); return () => { active = false; }; }, [reload]);

  async function act(item: Item, action: "CLAIM" | "TRANSITION" | "FOLLOW_UP", body?: string) {
    setBusy(`${action}:${item.id}`); setError(undefined);
    try {
      const response = await fetch("/api/office-public-intake", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, queue: item.queue, record_kind: item.record_kind, id: item.id, version: item.version, ...(action === "TRANSITION" ? { status: "RESOLVED" } : {}), ...(action === "FOLLOW_UP" ? { body } : {}) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Public intake action failed");
      if (action === "FOLLOW_UP") {
        setReply((current) => ({ ...current, [item.id]: "" })); setReplying(undefined);
        const suffix = result.email_delivery === "sent" ? " The requester email was accepted by the delivery provider." : result.email_delivery === "unknown" ? " The reply was saved, but email delivery is unknown and was not retried." : " The reply was saved, but email delivery was not confirmed.";
        setNotice(`Follow-up recorded.${suffix}`);
      } else setNotice(action === "CLAIM" ? "Request claimed for your Office review." : "Request marked resolved with an auditable internal event.");
      await reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Public intake action failed"); }
    finally { setBusy(undefined); }
  }
  function submitReply(event: FormEvent<HTMLFormElement>, item: Item) { event.preventDefault(); const body = reply[item.id]?.trim(); if (body) void act(item, "FOLLOW_UP", body); }
  const open = useMemo(() => (data?.items ?? []).filter((item) => !["RESOLVED", "CLOSED"].includes(item.status)), [data?.items]);

  if (error && !data) return <section className={styles.state}><CircleAlert /><div><b>Public intake unavailable</b><span>{error}</span></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><b>Loading public intake</b><span>Checking your Office authorisation and recorded requests.</span></div></section>;

  return <section className={styles.shell} aria-label={copy.eyebrow}>
    <header><div><p>{copy.eyebrow}</p><h3>{copy.title}</h3><span>{data.disclaimer}</span></div><strong>{open.length} open</strong></header>
    {notice ? <div className={styles.notice}><ShieldCheck /> <span>{notice}</span><button type="button" onClick={() => setNotice(undefined)} aria-label="Dismiss notification">×</button></div> : null}
    {error ? <div className={styles.error}><CircleAlert /> {error}</div> : null}
    <div className={styles.cards}>{data.items.map((item) => {
      const isBusy = Boolean(busy?.endsWith(item.id));
      const lastUpdate = item.updates.at(-1);
      return <article className={styles.card} key={`${item.record_kind}:${item.id}`}>
        <header><div><code>{item.reference}</code><h4>{item.subject}</h4><span>{label(item.record_kind)} · {label(item.category)} · received {dateTime(item.created_at)}</span></div><em data-status={item.status}>{label(item.status)}</em></header>
        <p className={styles.requester}><b>{item.requester_name}</b> · <a href={`mailto:${item.requester_email}`}>{item.requester_email}</a>{item.organisation ? ` · ${item.organisation}` : ""}</p>
        <p className={styles.description}>{item.description}</p>
        {lastUpdate ? <p className={styles.lastUpdate}><ClipboardCheck /> Last update: {lastUpdate.customer_visible ? "requester-visible" : "internal"} · {label(lastUpdate.email_delivery_status)} · {dateTime(lastUpdate.created_at)}</p> : null}
        {data.can_manage && !["RESOLVED", "CLOSED"].includes(item.status) ? <footer>
          {!item.office_assigned_to ? <button type="button" onClick={() => void act(item, "CLAIM")} disabled={isBusy}><UserRoundCheck /> Claim</button> : null}
          <button type="button" onClick={() => setReplying(replying === item.id ? undefined : item.id)} disabled={isBusy}><Mail /> Reply by email</button>
        </footer> : null}
        {replying === item.id ? <form className={styles.reply} onSubmit={(event) => submitReply(event, item)}><label>Reply to {item.requester_name}<textarea value={reply[item.id] ?? ""} onChange={(event) => setReply((current) => ({ ...current, [item.id]: event.target.value }))} minLength={1} maxLength={5000} rows={4} placeholder="Write a clear, reviewed response. It will be saved before email delivery is requested." required /></label><p>The message will be recorded as a requester-visible update. Delivery is never retried automatically when its outcome is unknown.</p><div><button type="button" onClick={() => setReplying(undefined)} disabled={isBusy}>Cancel</button><button type="submit" disabled={isBusy || !reply[item.id]?.trim()}>{isBusy ? <LoaderCircle className={styles.spin} /> : <Send />} Send reviewed follow-up</button></div></form> : null}
      </article>;
    })}{!data.items.length ? <div className={styles.empty}><ClipboardCheck /><b>{copy.empty}</b><span>KRAVIA does not create sample enquiries or artificial follow-ups.</span></div> : null}</div>
  </section>;
}
