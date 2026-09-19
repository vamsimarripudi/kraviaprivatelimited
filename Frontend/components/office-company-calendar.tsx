"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, Plus, ShieldCheck, X } from "lucide-react";
import { officeMutation, officeQuery } from "@/lib/office/http-client";
import styles from "./office-company-calendar.module.css";

type CalendarEvent = {
  id: string;
  event_code?: string | null;
  title: string;
  description: string;
  event_type: string;
  visibility_scope: string;
  scope_key?: string | null;
  starts_at: string;
  ends_at?: string | null;
  all_day: boolean;
  created_by?: string | null;
  owner_user_id?: string | null;
  source_type?: string | null;
  source_key?: string | null;
  projected: boolean;
};

type CalendarData = {
  actor: { user_id: string; roles: string[]; department?: string | null; team?: string | null; privileged: boolean };
  generated_at: string;
  events: CalendarEvent[];
};

type Draft = { title: string; description: string; eventType: string; visibility: string; scopeKey: string; startsAt: string; endsAt: string; allDay: boolean };
const emptyDraft: Draft = { title: "", description: "", eventType: "MEETING", visibility: "PERSONAL", scopeKey: "", startsAt: "", endsAt: "", allDay: false };

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
    invalidate: "/api/office-calendar",
  });
}

function monthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function localDayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function eventLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function moveMonth(anchor: string, delta: number) {
  const [year, month] = anchor.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function OfficeCompanyCalendar() {
  const [data, setData] = useState<CalendarData>();
  const [anchor, setAnchor] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<CalendarEvent>();

  async function reload() {
    const next = await json<CalendarData>("/api/office-calendar");
    setData(next);
    setAnchor((current) => current || monthKey(next.generated_at));
  }

  useEffect(() => {
    let alive = true;
    void json<CalendarData>("/api/office-calendar").then((next) => {
      if (!alive) return;
      setData(next);
      setAnchor(monthKey(next.generated_at));
    }).catch((caught: unknown) => {
      if (alive) setError(caught instanceof Error ? caught.message : "Unable to load company calendar");
    });
    return () => { alive = false; };
  }, []);

  const month = useMemo(() => {
    if (!anchor) return { label: "", days: [] as Array<{ key: string; day: number; current: boolean }> };
    const [year, monthNumber] = anchor.split("-").map(Number);
    const first = new Date(year, monthNumber - 1, 1);
    const gridStart = new Date(year, monthNumber - 1, 1 - first.getDay());
    const days = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        day: date.getDate(),
        current: date.getMonth() === monthNumber - 1,
      };
    });
    return { label: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(first), days };
  }, [anchor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of data?.events ?? []) {
      const key = localDayKey(event.starts_at);
      if (!key) continue;
      const current = map.get(key) ?? [];
      current.push(event);
      map.set(key, current);
    }
    return map;
  }, [data?.events]);

  const upcoming = useMemo(() => {
    if (!data) return [];
    const cutoff = Date.parse(data.generated_at);
    return data.events.filter((event) => Date.parse(event.starts_at) >= cutoff).slice(0, 12);
  }, [data]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setError(undefined);
    try {
      await json("/api/office-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description || undefined,
          event_type: draft.eventType,
          visibility: draft.visibility,
          scope_key: draft.scopeKey || undefined,
          starts_at: new Date(draft.startsAt).toISOString(),
          ends_at: draft.endsAt ? new Date(draft.endsAt).toISOString() : undefined,
          all_day: draft.allDay,
        }),
      });
      setDraft(emptyDraft);
      setNewOpen(false);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create event");
    } finally {
      setBusy(undefined);
    }
  }

  async function cancel(event: CalendarEvent) {
    if (event.projected) return;
    setBusy(event.id);
    setError(undefined);
    try {
      await json(`/api/office-calendar?event_id=${encodeURIComponent(event.id)}`, { method: "DELETE" });
      setSelected(undefined);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to cancel event");
    } finally {
      setBusy(undefined);
    }
  }

  if (!data && !error) return <section className={styles.state}><LoaderCircle className="spin" /><div><h2>Preparing company calendar</h2><p>Combining governed events with real operational deadlines.</p></div></section>;

  const visibilityOptions = [
    { value: "PERSONAL", label: "Personal", scope: "" },
    ...(data?.actor.department ? [{ value: "DEPARTMENT", label: `Department · ${data.actor.department}`, scope: data.actor.department }] : []),
    ...(data?.actor.team ? [{ value: "TEAM", label: `Team · ${data.actor.team}`, scope: data.actor.team }] : []),
    ...(data?.actor.privileged ? [{ value: "COMPANY", label: "Company", scope: "" }] : []),
  ];

  return <section className={styles.shell}>
    <header className={styles.hero}><div><p>COMPANY CALENDAR</p><h2>One operational timeline.</h2><span>Tasks, compliance, governance, contracts and subscriptions appear only when your role may see them.</span></div><button type="button" onClick={() => setNewOpen(true)}><Plus /> New event</button></header>
    {error ? <div className={styles.error}>{error}</div> : null}

    <div className={styles.layout}>
      <section className={styles.calendar}>
        <header><button type="button" aria-label="Previous month" onClick={() => setAnchor((current) => moveMonth(current, -1))}><ChevronLeft /></button><div><p>MONTH</p><h3>{month.label}</h3></div><button type="button" aria-label="Next month" onClick={() => setAnchor((current) => moveMonth(current, 1))}><ChevronRight /></button></header>
        <div className={styles.weekdays}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className={styles.grid}>{month.days.map((day) => {
          const rows = eventsByDay.get(day.key) ?? [];
          return <article key={day.key} data-current={day.current}><b>{day.day}</b><div>{rows.slice(0, 3).map((event) => <button key={event.id} type="button" data-type={event.event_type} onClick={() => setSelected(event)}><span>{event.projected ? "◆" : "●"}</span>{event.title}</button>)}{rows.length > 3 ? <small>+{rows.length - 3} more</small> : null}</div></article>;
        })}</div>
      </section>

      <aside className={styles.agenda}><header><CalendarDays /><div><p>UPCOMING</p><h3>Next on the timeline</h3></div></header><div>{upcoming.length ? upcoming.map((event) => <button key={event.id} type="button" onClick={() => setSelected(event)}><span data-type={event.event_type}>{eventLabel(event.event_type)}</span><b>{event.title}</b><small>{dateLabel(event.starts_at)} · {event.source_type || event.visibility_scope}</small></button>) : <p className={styles.empty}>No upcoming events.</p>}</div></aside>
    </div>

    {newOpen ? <div className={styles.backdrop} role="presentation" onMouseDown={() => setNewOpen(false)}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label="Create company calendar event" onMouseDown={(event) => event.stopPropagation()}><header><div><p>NEW EVENT</p><h2>Add to company calendar</h2></div><button type="button" aria-label="Close" onClick={() => setNewOpen(false)}><X /></button></header><form onSubmit={submit}>
      <label>Title<input required minLength={3} maxLength={180} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
      <label>Description<textarea rows={4} maxLength={4000} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
      <div className={styles.formGrid}><label>Type<select value={draft.eventType} onChange={(event) => setDraft((current) => ({ ...current, eventType: event.target.value }))}>{["MEETING","DEADLINE","LAUNCH","CUSTOMER","MAINTENANCE","REVIEW","REMINDER","OTHER"].map((value) => <option key={value} value={value}>{eventLabel(value)}</option>)}</select></label><label>Visibility<select value={draft.visibility} onChange={(event) => { const option = visibilityOptions.find((item) => item.value === event.target.value); setDraft((current) => ({ ...current, visibility: event.target.value, scopeKey: option?.scope ?? "" })); }}>{visibilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
      <div className={styles.formGrid}><label>Starts<input required type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value }))} /></label><label>Ends<input type="datetime-local" value={draft.endsAt} onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))} /></label></div>
      <label className={styles.check}><input type="checkbox" checked={draft.allDay} onChange={(event) => setDraft((current) => ({ ...current, allDay: event.target.checked }))} /> All-day event</label>
      <div className={styles.guard}><ShieldCheck /><p>Company-wide visibility is reserved for executive or delegated administration. System-projected deadlines cannot be edited here.</p></div>
      <button className={styles.submit} type="submit" disabled={busy === "create" || !draft.startsAt}>{busy === "create" ? <LoaderCircle className="spin" /> : <Plus />} Create event</button>
    </form></aside></div> : null}

    {selected ? <div className={styles.backdrop} role="presentation" onMouseDown={() => setSelected(undefined)}><section className={styles.detail} role="dialog" aria-modal="true" aria-label="Calendar event details" onMouseDown={(event) => event.stopPropagation()}><header><div><p>{selected.event_type}</p><h2>{selected.title}</h2></div><button type="button" aria-label="Close" onClick={() => setSelected(undefined)}><X /></button></header><div className={styles.detailBody}><p>{selected.description || "No additional description."}</p><dl><div><dt>Starts</dt><dd>{dateLabel(selected.starts_at)}</dd></div><div><dt>Source</dt><dd>{selected.source_type || selected.visibility_scope}</dd></div><div><dt>Reference</dt><dd>{selected.event_code || selected.source_key || "System projection"}</dd></div></dl>{!selected.projected ? <button className={styles.cancel} type="button" disabled={busy === selected.id} onClick={() => void cancel(selected)}>{busy === selected.id ? <LoaderCircle className="spin" /> : null} Cancel event</button> : <div className={styles.projected}><ShieldCheck /> Read-only projection from a canonical company record.</div>}</div></section></div> : null}
  </section>;
}
