"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, LoaderCircle, ShieldCheck } from "lucide-react";
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
  const [clock, setClock] = useState(Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);

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

  useEffect(() => {
    void reload();
    const refresh = window.setInterval(() => void reload(), 30_000);
    const tick = window.setInterval(() => setClock(Date.now()), 1_000);
    const onVisible = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", onVisible);
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("kravia-office-workforce");
      channel.onmessage = () => void reload();
      channelRef.current = channel;
    }
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      channelRef.current?.close();
    };
  }, [reload]);

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
        body: JSON.stringify({
          status,
          until: status === "AVAILABLE" ? null : expiryIso(expiry),
          work_mode: state?.presence.work_mode ?? null,
          client_event_id: crypto.randomUUID(),
        }),
      }));
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
        body: JSON.stringify({
          action,
          work_mode: action === "CHECK_IN" ? workMode : undefined,
          time_zone: timeZone,
          client_event_id: crypto.randomUUID(),
        }),
      }));
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
    if (state.attendance.state !== "WORKING") return state.attendance.tracked_seconds;
    const serverAt = Date.parse(state.server_time);
    const extra = Number.isFinite(serverAt) ? Math.max(0, Math.floor((clock - serverAt) / 1000)) : 0;
    return state.attendance.tracked_seconds + extra;
  }, [clock, state]);

  return <details className={styles.control}>
    <summary className={styles.summary} aria-label="Open workforce status">
      <span className={styles.dot} data-status={availability.value} aria-hidden="true" />
      <span><b>{availability.label}</b><small>{state?.attendance.state === "ON_BREAK" ? "On break" : state?.attendance.state === "WORKING" ? duration(liveTracked) : employment.label}</small></span>
    </summary>
    <div className={styles.panel}>
      <header><div><p>MY STATUS</p><h2>{availability.emoji} {availability.label}</h2></div>{busy ? <LoaderCircle className="spin" /> : <ShieldCheck />}</header>

      {error ? <div className={styles.error}>{error}</div> : null}
      {!state ? <div className={styles.loading}><LoaderCircle className="spin" /> Resolving live workforce state…</div> : <>
        <div className={styles.employment}><span>{employment.emoji}</span><div><b>{employment.label}</b><small>{state.employment_status.source} authority</small></div></div>

        <section>
          <label>Availability</label>
          <div className={styles.statusGrid}>{officeAvailabilityOptions.map((option) => <button key={option.value} type="button" disabled={busy} data-active={state.presence.effective_status === option.value} onClick={() => void setAvailability(option.value)}><span>{option.emoji}</span>{option.label}</button>)}</div>
        </section>

        <section className={styles.expiryRow}>
          <label htmlFor="presence-expiry">Auto-clear status</label>
          <select id="presence-expiry" value={expiry} onChange={(event) => setExpiry(event.target.value as ExpirySelection)}>
            <option value="NONE">No expiry</option><option value="1H">In 1 hour</option><option value="4H">In 4 hours</option><option value="EOD">End of day</option>
          </select>
        </section>

        <section className={styles.attendance}>
          <div className={styles.attendanceHead}><div><label>Attendance</label><strong>{state.attendance.state === "OFF_CLOCK" ? "Not checked in" : state.attendance.state === "ON_BREAK" ? "Break active" : duration(liveTracked)}</strong></div><Clock3 /></div>
          {state.attendance.state === "OFF_CLOCK" ? <>
            <select aria-label="Work mode" value={workMode} onChange={(event) => setWorkMode(event.target.value as WorkModeSelection)}>
              <option value="">Choose work mode</option>{officeWorkModeOptions.map((option) => <option key={option.value} value={option.value}>{option.emoji} {option.label}</option>)}
            </select>
            <button className={styles.primary} type="button" disabled={busy || !workMode || !attendanceAllowed} onClick={() => void attendance("CHECK_IN")}>Check in</button>
            {!attendanceAllowed ? <small className={styles.blocked}>Attendance is controlled by your current workforce status.</small> : null}
          </> : <>
            <div className={styles.modeLine}>{workModeOption(state.attendance.current_session?.work_mode ?? "UNSPECIFIED")?.emoji ?? "💼"} {workModeOption(state.attendance.current_session?.work_mode ?? "UNSPECIFIED")?.label ?? "Working"}</div>
            <div className={styles.attendanceActions}>{state.attendance.state === "ON_BREAK" ? <button type="button" disabled={busy} onClick={() => void attendance("BREAK_END")}>End break</button> : <button type="button" disabled={busy} onClick={() => void attendance("BREAK_START")}>Start break</button>}<button className={styles.danger} type="button" disabled={busy} onClick={() => void attendance("CHECK_OUT")}>Check out</button></div>
          </>}
        </section>

        <p className={styles.note}>Presence, attendance and authenticated sessions remain separate records. Browser activity is never treated as payroll time.</p>
      </>}
    </div>
  </details>;
}
