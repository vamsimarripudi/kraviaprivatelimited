"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Circle, LoaderCircle, MailOpen, Search, X } from "lucide-react";
import { officeMutation, officeQuery } from "@/lib/office/http-client";
import styles from "./office-notification-center.module.css";

type Notification = { id: string; request_id?: string | null; kind: string; title: string; body: string; status: string; created_at: string; read_at?: string | null };
type Center = { unread: number; notifications: Notification[] };

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase();
  if (method === "GET") {
    return officeQuery<T>(url, undefined, { staleMs: 10_000 });
  }
  const body = typeof options?.body === "string"
    ? JSON.parse(options.body)
    : options?.body;
  return officeMutation<T>(url, {
    method: method as "POST" | "PUT" | "PATCH" | "DELETE",
    body,
    invalidate: "/api/office-notifications",
  });
}

function readable(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function OfficeNotificationCenter() {
  const [data, setData] = useState<Center>();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  async function reload() {
    const next = await json<Center>("/api/office-notifications");
    setData(next);
  }

  useEffect(() => {
    let alive = true;
    void json<Center>("/api/office-notifications").then((next) => { if (alive) setData(next); }).catch((caught: unknown) => {
      if (alive) setError(caught instanceof Error ? caught.message : "Unable to load notifications");
    });
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data?.notifications ?? [];
    return (data?.notifications ?? []).filter((item) => `${item.kind} ${item.title} ${item.body} ${item.status}`.toLowerCase().includes(needle));
  }, [data?.notifications, search]);

  async function mutate(action: "READ" | "UNREAD" | "DISMISS" | "READ_ALL", id?: string) {
    setBusy(id ?? action);
    setError(undefined);
    try {
      await json("/api/office-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "READ_ALL" ? { action } : { action, notification_id: id }),
      });
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update notification");
    } finally {
      setBusy(undefined);
    }
  }

  if (!data && !error) return <section className={styles.state}><LoaderCircle className="spin" /><div><h2>Opening notifications</h2><p>Resolving your private Office inbox.</p></div></section>;

  return <section className={styles.shell}>
    <header className={styles.hero}><div><p>NOTIFICATION CENTER</p><h2>Signals that need your attention.</h2><span>{data?.unread ?? 0} unread · personal to your Office identity</span></div><button type="button" disabled={!data?.unread || Boolean(busy)} onClick={() => void mutate("READ_ALL")}><CheckCheck /> Mark all read</button></header>
    {error ? <div className={styles.error}>{error}</div> : null}
    <div className={styles.toolbar}><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notifications" /></label><strong>{rows.length} visible</strong></div>
    <div className={styles.list}>{rows.length ? rows.map((item) => <article className={styles.item} key={item.id} data-unread={item.status === "UNREAD"}>
      <div className={styles.icon}>{item.status === "UNREAD" ? <Circle /> : <MailOpen />}</div>
      <div className={styles.copy}><div><span>{item.kind.replaceAll("_", " ")}</span><small>{readable(item.created_at)}</small></div><h3>{item.title}</h3><p>{item.body}</p>{item.request_id ? <Link href="/office/requests">Open related request →</Link> : null}</div>
      <div className={styles.actions}>{item.status === "UNREAD" ? <button type="button" disabled={busy === item.id} onClick={() => void mutate("READ", item.id)}>Read</button> : <button type="button" disabled={busy === item.id} onClick={() => void mutate("UNREAD", item.id)}>Unread</button>}<button aria-label="Dismiss" type="button" disabled={busy === item.id} onClick={() => void mutate("DISMISS", item.id)}><X /></button></div>
    </article>) : <div className={styles.empty}><Bell /><div><b>No matching notifications</b><p>New workflow, task and security signals will appear here.</p></div></div>}</div>
  </section>;
}
