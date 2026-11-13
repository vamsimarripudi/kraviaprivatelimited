"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Clock3, LoaderCircle, MoreHorizontal, X } from "lucide-react";
import Link from "next/link";
import {
  availabilityOption,
  officeAvailabilityOptions,
  officeEmploymentStatusMeta,
  officeWorkModeOptions,
  workModeOption,
  type OfficeAvailabilityStatus,
  type OfficeEmploymentStatus,
  type OfficeWorkMode,
} from "@/lib/office/workforce-presence";
import styles from "./office-presence-control.module.css";

type WorkforceState = {
  server_time: string;
  presence: {
    availability_status: OfficeAvailabilityStatus;
    effective_status: OfficeAvailabilityStatus;
    work_mode: OfficeWorkMode;
    status_note?: string | null;
    status_until?: string | null;
  };
  employment_status: {
    status: OfficeEmploymentStatus;
    effective_from: string;
    effective_to?: string | null;
    source: string;
    reason?: string | null;
  };
  attendance: {
    state: "OFF_CLOCK" | "WORKING" | "ON_BREAK";
    current_session?: { id: string; work_mode: Exclude<OfficeWorkMode, "UNSPECIFIED">; check_in_at: string } | null;
    current_break?: { id: string; started_at: string } | null;
    tracked_seconds: number;
  };
};

type WorkModeSelection = Exclude<OfficeWorkMode, "UNSPECIFIED"> | "";
type ExpirySelection = "NONE" | "1H" | "4H" | "EOD";

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Workforce request failed");
  return body as T;
}

function expiryIso(value: ExpirySelection) {
  if (value === "NONE") return null;
  const now = new Date();
  if (value === "1H") return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  if (value === "4H") return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

function duration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function OfficePresenceControl() {
  const [state, setState] = useState<WorkforceState>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [expiry, setExpiry] = useState<ExpirySelection>("NONE");
  const [workMode, setWorkMode] = useState<WorkModeSelection>("");
  const [clock, setClock] = useState(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Native dialogs escape stacking contexts, but transformed sticky ancestors
  // can still shift their fixed containing block on mobile browsers.
  // Mount directly under Office main, outside the overflow-hidden header.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(".kravia-office .office-modern .office-main");
      if (target) setPortalTarget(target);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function openDialog() {
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
      setDialogOpen(true);
    }
  }

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close();
    else setDialogOpen(false);
  }

  function finishDialogClose() {
    setDialogOpen(false);
    if (menuRef.current) menuRef.current.open = false;
    triggerRef.current?.focus();
  }

  const reload = useCallback(async () => {
    try {
      const next = await json<WorkforceState>("/api/office-presence");
      setState(next);
      setError(undefined);
      if (!next.attendance.current_session && next.presence.work_mode !== "UNSPECIFIED") {
        setWorkMode(next.presence.work_mode as WorkModeSelection);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load workforce status");
    }
  }, []);

  const heartbeat = useCallback(async () => {
    try {
      await fetch("/api/office-auth/heartbeat", { method: "POST", cache: "no-store", credentials: "same-origin" });
    } catch {
      /* Session heartbeat is security telemetry and never changes attendance state. */
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void reload(), 0);
    const initialTick = window.setTimeout(() => setClock(Date.now()), 0);
    const initialHeartbeat = window.setTimeout(() => void heartbeat(), 5_000);
    const refresh = window.setInterval(() => void reload(), 30_000);
    const tick = window.setInterval(() => setClock(Date.now()), 1_000);
    const heartbeatTimer = window.setInterval(() => void heartbeat(), 120_000);
    const onVisible = () => { if (document.visibilityState === "visible") { void reload(); void heartbeat(); } };
    document.addEventListener("visibilitychange", onVisible);
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("kravia-office-workforce");
      channel.onmessage = () => void reload();
      channelRef.current = channel;
    }
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearTimeout(initialTick);
      window.clearTimeout(initialHeartbeat);
      window.clearInterval(refresh);
      window.clearInterval(tick);
      window.clearInterval(heartbeatTimer);
      document.removeEventListener("visibilitychange", onVisible);
      channelRef.current?.close();
    };
  }, [heartbeat, reload]);

  const announce = useCallback((next: WorkforceState) => {
    setState(next);
    setError(undefined);
    channelRef.current?.postMessage("refresh");
  }, []);

  async function setAvailability(status: OfficeAvailabilityStatus) {
    setBusy(true);
    try {
      announce(await json<WorkforceState>("/api/office-presence", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, until: status === "AVAILABLE" ? null : expiryIso(expiry), work_mode: state?.presence.work_mode ?? null, client_event_id: crypto.randomUUID() }),
      }));
      if (menuRef.current) menuRef.current.open = false;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update status");
    } finally {
      setBusy(false);
    }
  }

  async function attendance(action: "CHECK_IN" | "BREAK_START" | "BREAK_END" | "CHECK_OUT") {
    if (action === "CHECK_IN" && !workMode) return;
    setBusy(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      announce(await json<WorkforceState>("/api/office-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, work_mode: action === "CHECK_IN" ? workMode : undefined, time_zone: timeZone, client_event_id: crypto.randomUUID() }),
      }));
      if (menuRef.current) menuRef.current.open = false;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record attendance");
    } finally {
      setBusy(false);
    }
  }

  const availability = availabilityOption(state?.presence.effective_status ?? "AVAILABLE");
  const employment = officeEmploymentStatusMeta[state?.employment_status.status ?? "WORKING"];
  const attendanceAllowed = state ? ["WORKING", "BUSINESS_TRAVEL"].includes(state.employment_status.status) : false;
  const liveTracked = useMemo(() => {
    if (!state) return 0;
    if (state.attendance.state !== "WORKING" || clock === 0) return state.attendance.tracked_seconds;
    const serverAt = Date.parse(state.server_time);
    const extra = Number.isFinite(serverAt) ? Math.max(0, Math.floor((clock - serverAt) / 1000)) : 0;
    return state.attendance.tracked_seconds + extra;
  }, [clock, state]);


  return <div className={styles.control} data-office-presence-control="true">
    <button
      ref={triggerRef}
      type="button"
      className={styles.summary}
      data-office-presence-trigger="true"
      aria-haspopup="dialog"
      aria-controls="office-presence-dialog"
      aria-expanded={dialogOpen}
      aria-label={"Manage workforce status: " + availability.label}
      disabled={!portalTarget}
      onClick={openDialog}
    >
      <span className={styles.dot} data-status={availability.value} aria-hidden="true" />
      <span><b>{availability.label}</b><small>{state?.attendance.state === "ON_BREAK" ? "On break" : state?.attendance.state === "WORKING" ? "Working · " + duration(liveTracked) : "Check in to record work"}</small></span>
    </button>

    {portalTarget ? createPortal(<dialog
      id="office-presence-dialog"
      ref={dialogRef}
      className={styles.panel}
      data-office-presence-dialog="true"
      aria-labelledby="office-presence-heading"
      aria-modal="true"
      onClose={finishDialogClose}
      onCancel={(event) => { event.preventDefault(); closeDialog(); }}
      onMouseDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
      }}
    >
      <header className={styles.heading}>
        <div className={styles.headingText}>
          <p>MY STATUS</p>
          <h2 id="office-presence-heading">Workforce status</h2>
        </div>
        <div className={styles.headingActions}>
          <details ref={menuRef} className={styles.actionsMenu} data-office-presence-actions="true">
            <summary aria-label="Attendance, availability and OOO actions" title="Attendance and status actions">
              <MoreHorizontal aria-hidden="true" />
              <span>Actions</span>
              <ChevronDown aria-hidden="true" />
            </summary>
            <div className={styles.actionsContent}>
              {state ? <>
                <div className={styles.menuGroup}>
                  <p className={styles.menuLabel}>Attendance</p>
                  {state.attendance.state === "OFF_CLOCK" ? <>
                    <label htmlFor="office-presence-work-mode">Work mode</label>
                    <select id="office-presence-work-mode" value={workMode} disabled={busy} onChange={(event) => setWorkMode(event.target.value as WorkModeSelection)}>
                      <option value="">Choose work mode</option>
                      {officeWorkModeOptions.map((option) => <option key={option.value} value={option.value}>{option.emoji} {option.label}</option>)}
                    </select>
                    <button className={styles.primary} type="button" disabled={busy || !workMode || !attendanceAllowed} onClick={() => void attendance("CHECK_IN")}>Check in</button>
                    {!attendanceAllowed ? <small className={styles.blocked}>Your current employment status does not permit check-in.</small> : null}
                  </> : <>
                    {state.attendance.state === "ON_BREAK" ? <button type="button" disabled={busy} onClick={() => void attendance("BREAK_END")}>End break</button> : <button type="button" disabled={busy} onClick={() => void attendance("BREAK_START")}>Start break</button>}
                    <button className={styles.danger} type="button" disabled={busy} onClick={() => void attendance("CHECK_OUT")}>Check out</button>
                  </>}
                </div>
                <div className={styles.menuGroup}>
                  <p className={styles.menuLabel}>Availability / OOO</p>
                  <div className={styles.statusGrid}>
                    {officeAvailabilityOptions.map((option) => <button key={option.value} type="button" disabled={busy} data-active={state.presence.effective_status === option.value} onClick={() => void setAvailability(option.value)}><span aria-hidden="true">{option.emoji}</span> {option.label}</button>)}
                  </div>
                  <label htmlFor="office-presence-expiry">Auto-clear next availability change</label>
                  <select id="office-presence-expiry" disabled={busy} value={expiry} onChange={(event) => setExpiry(event.target.value as ExpirySelection)}>
                    <option value="NONE">No expiry</option><option value="1H">In 1 hour</option>
                    <option value="4H">In 4 hours</option><option value="EOD">End of day</option>
                  </select>
                </div>
              </> : <p className={styles.loading}>Loading current status…</p>}
            </div>
          </details>
          <button className={styles.closeButton} type="button" aria-label="Close workforce status" onClick={closeDialog}><X aria-hidden="true" /></button>
        </div>
      </header>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {busy ? <p className={styles.updating} role="status"><LoaderCircle aria-hidden="true" className="spin" /> Updating status…</p> : null}
      {!state ? <p className={styles.loading}><LoaderCircle className="spin" aria-hidden="true" /> Resolving live workforce state…</p> : <>
        <div className={styles.statusSummary} aria-live="polite">
          <div><span>Availability</span><strong>{availability.emoji} {availability.label}</strong></div>
          <div><span>Attendance</span><strong>{state.attendance.state === "OFF_CLOCK" ? "Not checked in" : state.attendance.state === "ON_BREAK" ? "Break active" : "Working · " + duration(liveTracked)}</strong></div>
          <div><span>Employment</span><strong>{employment.emoji} {employment.label}</strong></div>
          {state.attendance.current_session ? <div><span>Work mode</span><strong>{workModeOption(state.attendance.current_session.work_mode)?.emoji ?? "💼"} {workModeOption(state.attendance.current_session.work_mode)?.label ?? "Working"}</strong></div> : null}
        </div>
        <div className={styles.attendance}>
          <Clock3 aria-hidden="true" />
          <div>
            <strong>Six-hour weekday target</strong>
            <p>{state.attendance.state === "OFF_CLOCK" ? "Use Actions → Check in to begin a tracked session." : state.attendance.state === "ON_BREAK" ? "Your break is active. Use Actions → End break or Check out." : "Tracked today: " + duration(liveTracked) + ". Use Actions to take a break or check out."}</p>
          </div>
        </div>
        <p className={styles.note}>Attendance and sign-in are separate. Browser activity is never treated as payroll time. <Link href="/office/worktime" onClick={closeDialog}>View timesheets and corrections</Link>.</p>
      </>}
    </dialog>, portalTarget) : null}
  </div>;
}
