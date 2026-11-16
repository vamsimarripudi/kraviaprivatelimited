"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { OfficeIstClock } from "@/components/office-ist-clock";
import type { WorkspaceKind } from "@/lib/office/workspaces";
import styles from "./office-topbar-calendar.module.css";

type IstDay = { year: number; month: number; day: number };
type CalendarEntry = { id: string; title: string; event_type: string; starts_at: string; projected?: boolean };
type CalendarPayload = { events: CalendarEntry[]; generated_at: string };

const zone = "Asia/Kolkata";
const dateParts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
const monthLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });
const shortMonth = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" });
const eventTime = new Intl.DateTimeFormat("en-IN", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: true });
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function istDay(date: Date): IstDay {
  const fields = Object.fromEntries(dateParts.formatToParts(date).map(part => [part.type, part.value]));
  return { year: Number(fields.year), month: Number(fields.month), day: Number(fields.day) };
}
function dateKey(value: IstDay) {
  return [value.year, String(value.month).padStart(2, "0"), String(value.day).padStart(2, "0")].join("-");
}
function shiftedMonth(value: IstDay, offset: number) {
  const first = new Date(Date.UTC(value.year, value.month - 1 + offset, 1));
  return { year: first.getUTCFullYear(), month: first.getUTCMonth() + 1, day: 1 };
}
function eventKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateKey(istDay(date));
}
function monthDays(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const offset = (start.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1, 1 - offset + i));
    const day = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
    return { ...day, key: dateKey(day), inMonth: day.month === month };
  });
}

/** Clock-triggered calendar. No synthetic events, no department navigation changes. */
export function OfficeTopbarCalendar({
  workspace, theme, onOpen,
}: {
  workspace: WorkspaceKind;
  theme: "light" | "dark";
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { setPortal(document.body); setNow(new Date()); });
    const tick = () => setNow(new Date());
    const interval = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/office-calendar", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!response.ok) throw new Error("Company calendar unavailable");
        const body: unknown = await response.json();
        if (!body || typeof body !== "object" || !("events" in body) || !Array.isArray(body.events)) {
          throw new Error("Invalid company calendar response");
        }
        if (!controller.signal.aborted) setData(body as CalendarPayload);
      } catch {
        if (!controller.signal.aborted) setError("Company events are unavailable for this account. Calendar dates still work.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      controller.abort();
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = before;
      document.removeEventListener("keydown", handleKey);
      triggerRef.current?.focus();
    };
  }, [open]);

  function openCalendar() {
    setMonthOffset(0);
    setSelected(dateKey(istDay(new Date())));
    setData(null);
    setError("");
    setLoading(true);
    onOpen?.();
    setOpen(true);
  }

  const today = now ? istDay(now) : null;
  const month = shiftedMonth(today ?? { year: 2026, month: 1, day: 1 }, monthOffset);
  const days = useMemo(() => monthDays(month.year, month.month), [month.year, month.month]);
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of data?.events ?? []) {
      if (!entry || typeof entry.starts_at !== "string" || typeof entry.title !== "string") continue;
      const key = eventKey(entry.starts_at);
      if (!key) continue;
      const entries = map.get(key) ?? [];
      entries.push(entry);
      map.set(key, entries);
    }
    for (const events of map.values()) events.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    return map;
  }, [data]);
  const focusDay = selected && days.some(day => day.key === selected)
    ? selected : dateKey({ year: month.year, month: month.month, day: 1 });
  const dayEvents = grouped.get(focusDay) ?? [];
  const nextEvents = (data?.events ?? []).filter(entry =>
    entry && typeof entry.starts_at === "string" && now && Date.parse(entry.starts_at) >= now.getTime(),
  ).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).slice(0, 3);

  return <>
    <button type="button" ref={triggerRef} className={styles.trigger}
      data-office-topbar-calendar-trigger
      title="Open company calendar" aria-label="Open KRAVIA company calendar"
      aria-haspopup="dialog" aria-expanded={open} aria-controls="office-topbar-company-calendar"
      onClick={() => open ? setOpen(false) : openCalendar()}>
      <OfficeIstClock />
    </button>
    {open && portal ? createPortal(
      <div className={styles.backdrop} data-theme={theme} data-office-topbar-calendar-overlay role="presentation"
        onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section ref={dialogRef} id="office-topbar-company-calendar" role="dialog" aria-modal="true"
          aria-label="KRAVIA company calendar" className={styles.dialog} data-office-topbar-calendar-dialog>
          <header className={styles.header}>
            <div className={styles.headerTitle}>
              <p className={styles.eyebrow}><CalendarDays size={15} aria-hidden="true" /> KRAVIA · COMPANY CALENDAR</p>
              <h2>Company calendar</h2>
              <span>India Standard Time · Events available to your account</span>
            </div>
            <button ref={closeRef} type="button" className={styles.close}
              aria-label="Close company calendar" title="Close calendar"
              onClick={() => setOpen(false)}><X size={21} aria-hidden="true" /></button>
          </header>
          <div className={styles.content}>
            <div className={styles.month}>
              <div className={styles.monthToolbar}>
                <div><small>MONTH VIEW</small><h3>{monthLabel.format(new Date(Date.UTC(month.year, month.month - 1, 1)))}</h3></div>
                <div className={styles.monthActions}>
                  <button type="button" aria-label="Previous month" onClick={() => { setMonthOffset(x => x - 1); setSelected(null); }}><ChevronLeft size={18} /></button>
                  <button type="button" className={styles.today} aria-label="Return to current month" onClick={() => { setMonthOffset(0); setSelected(dateKey(istDay(new Date()))); }}>Today</button>
                  <button type="button" aria-label="Next month" onClick={() => { setMonthOffset(x => x + 1); setSelected(null); }}><ChevronRight size={18} /></button>
                </div>
              </div>
              <div className={styles.weekdays}>{weekdays.map(day => <span key={day}>{day}</span>)}</div>
              <div className={styles.days}>{days.map(day => {
                const hasEvents = Boolean(grouped.get(day.key)?.length);
                const isSelected = focusDay === day.key;
                return <button type="button" key={day.key} className={styles.day}
                  data-outside={!day.inMonth} data-selected={isSelected} data-today={Boolean(today && day.key === dateKey(today))}
                  aria-pressed={isSelected}
                  aria-label={String(day.day) + " " + shortMonth.format(new Date(Date.UTC(day.year, day.month - 1, 1))) + " " + day.year + (hasEvents ? ", company events" : "")}
                  onClick={() => setSelected(day.key)}>
                  <span>{day.day}</span>{hasEvents ? <i className={styles.dot} aria-hidden="true" /> : null}
                </button>;
              })}</div>
              <p className={styles.legend}>Outlined date = today · Dot = visible company event</p>
            </div>
            <aside className={styles.agenda}>
              <div className={styles.agendaHeader}><small>SELECTED DATE</small><strong>{focusDay}</strong></div>
              {loading ? <p className={styles.state} role="status">Loading company events…</p> : null}
              {error ? <p className={styles.error} role="status">{error}</p> : null}
              {!loading && !error ? dayEvents.length
                ? <ul className={styles.events}>{dayEvents.slice(0, 5).map(entry => <li key={entry.id}>
                    <span>{eventTime.format(new Date(entry.starts_at))}</span>
                    <strong>{entry.title}</strong>
                    <small>{entry.projected ? "Office projection" : entry.event_type || "Company event"}</small>
                  </li>)}</ul>
                : <p className={styles.state}>No company events for this date.</p> : null}
              <div className={styles.upcoming}>
                <small>NEXT UP</small>
                {nextEvents.length ? nextEvents.map(entry => <div key={entry.id}>
                  <strong>{entry.title}</strong>
                  <span>{eventKey(entry.starts_at)} · {eventTime.format(new Date(entry.starts_at))} IST</span>
                </div>) : <p className={styles.state}>No upcoming events available.</p>}
              </div>
            </aside>
          </div>
          {workspace === "office" ? <footer className={styles.footer}>
            <Link href="/office/calendar" onClick={() => setOpen(false)}>
              Open full company calendar <ExternalLink size={15} aria-hidden="true" />
            </Link>
          </footer> : null}
        </section>
      </div>,
      portal,
    ) : null}
  </>;
}
