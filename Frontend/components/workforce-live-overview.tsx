"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Building2, CircleDot, Laptop2, UsersRound } from "lucide-react";
import { availabilityOption, officeEmploymentStatusMeta, workModeOption, type OfficeAvailabilityStatus, type OfficeEmploymentStatus, type OfficeWorkMode } from "@/lib/office/workforce-presence";
import styles from "./workforce-live-overview.module.css";

type PersonRow = {
  user_id: string;
  person_id: string | null;
  person_code: string | null;
  employment_id: string | null;
  employment_code: string | null;
  display_name: string;
  department: string;
  job_title: string;
  employment_type: string | null;
  employment_record_status: string | null;
  availability_status: OfficeAvailabilityStatus;
  work_mode: OfficeWorkMode;
  workforce_status: OfficeEmploymentStatus;
  workforce_status_source: string;
  online_state: "ONLINE" | "IDLE" | "OFFLINE";
  session_aal: string | null;
  mfa_verified: boolean;
  session_started_at: string | null;
  last_seen_at: string | null;
  risk_level: string | null;
  attendance_state: "OFF_CLOCK" | "WORKING" | "ON_BREAK";
  check_in_at: string | null;
  attendance_time_zone: string | null;
};

type WorkforceOverview = {
  generated_at: string;
  summary: { active_people: number; online: number; idle: number; remote: number; office: number; on_leave: number; ooo: number; checked_in: number };
  people: PersonRow[];
};

function time(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(parsed);
}

function onlineLabel(state: PersonRow["online_state"]) {
  if (state === "ONLINE") return { emoji: "🟢", label: "Online" };
  if (state === "IDLE") return { emoji: "🟡", label: "Idle" };
  return { emoji: "⚪", label: "Offline" };
}

export function WorkforceLiveOverview() {
  const [overview, setOverview] = useState<WorkforceOverview>();
  const [error, setError] = useState<string>();
  const [denied, setDenied] = useState(false);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/office-workforce/overview", { cache: "no-store", credentials: "same-origin" });
      if (response.status === 401 || response.status === 403) { setDenied(true); return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Unable to load live workforce state");
      setOverview(body as WorkforceOverview);
      setError(undefined);
      setDenied(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load live workforce state");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void reload(), 0);
    const timer = window.setInterval(() => void reload(), 15_000);
    const visible = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [reload]);

  if (denied) return null;
  if (!overview && !error) return <section className={styles.shell}><div className={styles.loading}><Activity /> Loading live workforce authority…</div></section>;

  return <section className={styles.shell} aria-label="Live workforce overview">
    <header className={styles.header}>
      <div><p>WORKFORCE LIVE</p><h2>People availability & attendance</h2><span>Authentication, availability and payable attendance remain independent signals.</span></div>
      <div className={styles.live}><CircleDot /> Realtime</div>
    </header>
    {error ? <div className={styles.error}>{error}</div> : null}
    {overview ? <>
      <div className={styles.metrics}>
        <article><UsersRound /><div><b>{overview.summary.active_people}</b><span>Active people</span></div></article>
        <article><Activity /><div><b>{overview.summary.online}</b><span>Online now</span></div></article>
        <article><Laptop2 /><div><b>{overview.summary.remote}</b><span>Remote</span></div></article>
        <article><Building2 /><div><b>{overview.summary.office}</b><span>In office</span></div></article>
        <article><span className={styles.metricEmoji}>🌴</span><div><b>{overview.summary.on_leave}</b><span>On leave</span></div></article>
        <article><span className={styles.metricEmoji}>⏱️</span><div><b>{overview.summary.checked_in}</b><span>Checked in</span></div></article>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead><tr><th>Person</th><th>Presence</th><th>Availability</th><th>Work status</th><th>Attendance</th><th>Security session</th></tr></thead>
          <tbody>{overview.people.map((person) => {
            const online = onlineLabel(person.online_state);
            const availability = availabilityOption(person.availability_status);
            const employment = officeEmploymentStatusMeta[person.workforce_status];
            const mode = workModeOption(person.work_mode);
            const companyId = [person.person_code, person.employment_code].filter(Boolean).join(" · ") || "Identity pending";
            return <tr key={person.user_id}>
              <td><strong>{person.display_name}</strong><small>{companyId}</small><small>{person.job_title} · {person.department}</small></td>
              <td><span className={styles.state}>{online.emoji} {online.label}</span><small>Seen {time(person.last_seen_at)}</small></td>
              <td><span className={styles.state}>{availability.emoji} {availability.label}</span><small>{mode ? `${mode.emoji} ${mode.label}` : "Mode not set"}</small></td>
              <td><span className={styles.state}>{employment.emoji} {employment.label}</span><small>{person.workforce_status_source}</small></td>
              <td><span className={styles.state}>{person.attendance_state === "WORKING" ? "⏱️ Working" : person.attendance_state === "ON_BREAK" ? "☕ On break" : "— Off clock"}</span><small>{person.check_in_at ? `In ${time(person.check_in_at)}` : "No open session"}</small></td>
              <td><span className={styles.state}>{person.mfa_verified ? "🛡️ AAL2" : person.session_aal ? "🔐 AAL1" : "—"}</span><small>{person.risk_level ? `${person.risk_level} risk` : "No active session"}</small></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <footer>Updated {time(overview.generated_at)} · HR/authorised people viewers only · no payroll or sensitive employee fields exposed here</footer>
    </> : null}
  </section>;
}
