"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, CircleAlert, FileDown, LoaderCircle, ShieldCheck, Timer, Wallet, X } from "lucide-react";
import styles from "./office-worktime-console.module.css";
import type { WorktimeTargets } from "@/lib/office/flexible-worktime";

type Employee = { user_id: string; display_name: string | null };
type Claim = {
  id: string; employee_user_id: string; work_starts_at: string; work_ends_at: string;
  status: "PENDING" | "APPROVED" | "REJECTED"; requested_by: string; reviewed_by: string | null;
  source_reference: string; review_note: string | null;
};
type Policy = { id: string; status: string; effective_from: string; authority_reference: string; weekend_bps: number; weekday_ot_bps: number; night_premium_bps: number; proposed_by: string; employee_user_id: string };
type Premium = {
  workedMinutes: number; weekdayOvertimeMinutes: number; weekendMinutes: number; nightMinutes: number;
  totalAdditionalEarningsMinor: number; flexDaysEarnedThisMonth: number; warnings: string[];
};
type Slip = {
  id: string; code: string; period: string; due_date: string | null; status: string;
  net_pay_minor: number; confirmedMinor: number; balanceMinor: number;
};
type Snapshot = {
  actor: { user_id: string; roles: string[] }; employee: Employee; employees: Employee[];
  month: string; target_payment: { date: string; time: string; bankHolidayVerificationRequired: boolean };
  claims: Claim[]; policies: Policy[]; approved_policy: Policy | null; attendance_targets: WorktimeTargets;
  payroll_periods: Array<{ id: string; period_code: string; starts_on: string; ends_on: string; status: string }>;
  preview: Premium | null; salary_slips: Slip[];
  capabilities: { self: boolean; review_worktime: boolean; prepare_payroll: boolean };
  notice: string;
};
function money(minor?: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format((minor || 0) / 100); }
function formatHours(minutes: number) { return (minutes / 60).toFixed(2) + " hrs"; }
function istTimestamp(iso: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso)); }
function localIST(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Provide an IST date and time");
  const parsed = new Date(value + ":00+05:30");
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid IST time");
  return parsed.toISOString();
}
async function request<T>(input?: Record<string, unknown>, month?: string, employee?: string): Promise<T> {
  const query = new URLSearchParams();
  if (month) query.set("month", month);
  if (employee) query.set("employee", employee);
  const response = await fetch("/api/office-worktime" + (input ? "" : "?" + query), {
    method: input ? "POST" : "GET",
    headers: input ? { "Content-Type": "application/json" } : undefined,
    body: input ? JSON.stringify(input) : undefined,
    credentials: "same-origin", cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Worktime service unavailable");
  return body as T;
}
export function OfficeWorktimeConsole() {
  const [month, setMonth] = useState(() => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 7));
  const [employee, setEmployee] = useState("");
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"CORRECTION" | "POLICY" | "IMPORT" | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void request<Snapshot>(undefined, month, employee || undefined).then(payload => {
      if (active) { setData(payload); setError(""); }
    }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Cannot load worktime"); });
    return () => { active = false; };
  }, [month, employee]);

  async function mutate(action: Record<string, unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await request(action);
      const next = await request<Snapshot>(undefined, month, employee || undefined);
      setData(next); setNotice(success); setDraft({}); setMode(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (mode === "CORRECTION") {
        const startsAt = localIST(draft.startAt);
        const endsAt = localIST(draft.endAt);
        if (Date.parse(startsAt) < Date.parse("2026-07-31T18:30:00Z")) throw new Error("Historical evidence begins 1 August 2026 (IST)");
        if (Date.parse(endsAt) > Date.now() || Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error("Use a completed, non-future time interval");
        const hasBreak = Boolean(draft.breakStart || draft.breakEnd);
        if (hasBreak && (!draft.breakStart || !draft.breakEnd)) throw new Error("Both unpaid break timestamps are required");
        const breaks = hasBreak ? [{ startAt: localIST(draft.breakStart), endAt: localIST(draft.breakEnd) }] : [];
        if (breaks.length && (breaks[0].startAt < startsAt || breaks[0].endAt > endsAt || breaks[0].startAt >= breaks[0].endAt)) {
          throw new Error("Break must be inside the actual shift");
        }
        void mutate({ action: "SUBMIT", employeeId: data?.employee.user_id,
          sourceKind: "HISTORICAL_CORRECTION", startAt: startsAt,
          endAt: endsAt, breaks,
          sourceReference: draft.evidence, reason: draft.reason },
        "Historical attendance evidence submitted for independent review. No wage or attendance was fabricated.");
      } else if (mode === "POLICY") {
        void mutate({ action: "PROPOSE_POLICY", employeeId: data?.employee.user_id,
          effectiveFrom: draft.effectiveFrom, authorityReference: draft.authority },
        "Worktime policy proposed for independent director approval. No premiums are active yet.");
      } else if (mode === "IMPORT") {
        void mutate({ action: "IMPORT_PREMIUMS", employeeId: data?.employee.user_id, periodId: draft.periodId },
          "Verified premiums imported as payroll adjustments pending separate approval.");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid worktime input"); }
  }
  return <section className={styles.shell}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>KRAVIA OFFICE · WORKFORCE</span><h2>Worktime, Flex Days & Wage Records</h2>
        <p>Flexible six-hour weekdays · 30 net hours Monday-Friday · no fixed shift · track breaks · OT requires independent approval</p></div>
      <div className={styles.filters}>
        <label>Month<input aria-label="Payroll month" type="month" value={month} onChange={e => setMonth(e.target.value)}/></label>
        {data?.employees.length ? <label>Employee<select aria-label="Employee" value={employee} onChange={e => setEmployee(e.target.value)}>
          <option value="">My profile</option>{data.employees.map(person => <option key={person.user_id} value={person.user_id}>{person.display_name || "Employee"}</option>)}
        </select></label> : null}
      </div>
    </header>
    {error ? <div className={styles.error}><CircleAlert size={18}/>{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={15}/></button></div> : null}
    {notice ? <div className={styles.notice}><CheckCircle2 size={18}/>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={15}/></button></div> : null}
    {!data ? <p className={styles.loading}><LoaderCircle size={17}/>Loading verified attendance and payroll evidence…</p> :
      <>
        <div className={styles.summary}>
          <article><Timer size={20}/><small>Today's tracked work</small><strong>{formatHours(data.attendance_targets.today?.total_minutes ?? 0)}</strong><span>6 net hours on weekdays · {formatHours(data.attendance_targets.today?.remaining_minutes ?? 0)} remaining</span></article>
          <article><CalendarClock size={20}/><small>This week's working time</small><strong>{formatHours(data.attendance_targets.current_week?.tracked_minutes ?? 0)}</strong><span>30h target Mon-Fri · {formatHours(data.attendance_targets.current_week?.remaining_minutes ?? 0)} remaining</span></article>
          <article><ShieldCheck size={20}/><small>Recorded / approved historical</small><strong>{formatHours(data.attendance_targets.total_minutes)}</strong><span>{formatHours(data.attendance_targets.approved_historical_minutes)} in historical approvals · selected month</span></article>
          <article><Timer size={20}/><small>Potential overtime</small><strong>{formatHours(data.attendance_targets.potential_overtime_minutes)}</strong><span>Time beyond six weekday hours · not yet payable</span></article>
          <article><Wallet size={20}/><small>Approved time premiums</small><strong>{data.preview ? money(data.preview.totalAdditionalEarningsMinor) : "Not configured"}</strong><span>Independent policy and payroll review required</span></article>
          <article><CalendarClock size={20}/><small>Scheduled pay target</small><strong>{data.target_payment.date}</strong><span>6:00 P.M. IST · confirm bank holidays</span></article>
        </div>
        <article className={styles.panel}>
          <div className={styles.heading}><h3>Daily attendance · net time</h3><small>Effective tracking from 14 Nov 2026 · historical evidence from 1 Aug</small></div>
          <p>{data.attendance_targets.message}</p>
          <div className={styles.dailyLedger}>
            {data.attendance_targets.day_records.filter(day => day.daily_target_minutes > 0 || day.total_minutes > 0).slice(-31).reverse().map(day => (
              <div className={styles.dailyRow} key={day.date} data-attendance-status={day.status}>
                <span><b>{day.date}</b><small>{day.status === "TARGET_MET" ? "6h target met" :
                  day.status === "NOT_RECORDED" ? "No recorded evidence — HR to review, not automatically absent" :
                  day.status === "HISTORICAL" ? "Historical evidence / backfill" :
                  day.status === "NON_WORKDAY" ? "Optional weekend work" : "Below weekday target"}</small></span>
                <span><strong>{formatHours(day.total_minutes)}</strong><small>{day.daily_target_minutes ? formatHours(day.daily_target_minutes) + " target" : "No required hours"}</small></span>
                <span><b>{day.potential_overtime_minutes ? "+" + formatHours(day.potential_overtime_minutes) : "—"}</b><small>OT candidate</small></span>
              </div>
            ))}
            {!data.attendance_targets.day_records.some(day => day.daily_target_minutes > 0 || day.total_minutes > 0) ? <p className={styles.empty}>No completed time entries. Historical dates need source evidence and independent review; sign-in alone never counts as work.</p> : null}
          </div>
          <div className={styles.heading}><h3>Weekly 30-hour review</h3><small>Monday to Friday · net of unpaid breaks</small></div>
          <div className={styles.weekLedger}>{data.attendance_targets.weeks.map(week => <div className={styles.weekRow} key={week.monday}>
            <span><b>{week.monday} – {week.through}</b><small>{week.status === "HISTORICAL" ? "Historical / boundary week" : week.status === "TARGET_MET" ? "Weekly target met" : "Worktime still to verify"}</small></span>
            <span><strong>{formatHours(week.tracked_minutes)}</strong><small>{week.target_minutes ? formatHours(week.target_minutes) + " goal · " + formatHours(week.remaining_minutes) + " left" : "Target not assessed for this week"}</small></span>
          </div>)}</div>
        </article>
        <div className={styles.columns}>
          <article className={styles.panel}>
            <div className={styles.heading}><h3>Attendance & approvals</h3><button type="button" onClick={() => { setDraft({}); setMode(mode === "CORRECTION" ? null : "CORRECTION"); }}>{data.capabilities.review_worktime ? "Add / correct employee hours" : "Request correction"}</button></div>
            {data.claims.length ? data.claims.map(claim => <div className={styles.record} key={claim.id}>
              <span><b>{istTimestamp(claim.work_starts_at)}</b><small>Until {istTimestamp(claim.work_ends_at)}</small><small>{claim.source_reference}</small></span>
              <div><em>{claim.status}</em>{data.capabilities.review_worktime && claim.status === "PENDING" &&
                  claim.requested_by !== data.actor.user_id && claim.employee_user_id !== data.actor.user_id ? <div className={styles.actions}>
                    <button type="button" disabled={busy} onClick={() => void mutate({ action: "DECIDE", caseId: claim.id, decision: "APPROVE", note: "Verified evidence reviewed" }, "Approved independently.")}>Approve</button>
                    <button type="button" disabled={busy} onClick={() => void mutate({ action: "DECIDE", caseId: claim.id, decision: "REJECT", note: "Further evidence required" }, "Correction rejected with evidence request.")}>Reject</button>
                  </div> : null}</div>
            </div>) : <p className={styles.empty}>No time claims recorded for this employee and month. Historical work must be documented and independently reviewed.</p>}
          </article>
          <article className={styles.panel}>
            <div className={styles.heading}><h3>Work policy & premiums</h3>{data.capabilities.review_worktime ? <button type="button" onClick={() => { setDraft({ effectiveFrom: month + "-01" }); setMode(mode === "POLICY" ? null : "POLICY"); }}>Propose policy</button> : null}</div>
            <p>{data.approved_policy ? "Approved policy effective " + data.approved_policy.effective_from + " · " + data.approved_policy.authority_reference :
              "No approved worktime premium policy. Salary premiums must not be issued without signed authority."}</p>
            {data.preview ? <div className={styles.metrics}>
              <span>Weekday OT <b>{formatHours(data.preview.weekdayOvertimeMinutes)}</b></span>
              <span>Weekend work <b>{formatHours(data.preview.weekendMinutes)}</b></span>
              <span>Night work <b>{formatHours(data.preview.nightMinutes)}</b></span>
              {data.preview.warnings.map((warning, idx) => <p key={idx} className={styles.warning}>{warning}</p>)}
            </div> : null}
            {data.policies.filter(p => p.status === "DRAFT").map(p => <div className={styles.record} key={p.id}>
              <span><b>Pending policy</b><small>{p.effective_from}</small></span>
              {data.capabilities.review_worktime && p.proposed_by !== data.actor.user_id && p.employee_user_id !== data.actor.user_id ? <div className={styles.actions}>
                <button type="button" onClick={() => void mutate({ action: "DECIDE_POLICY", policyId: p.id, decision: "APPROVE" }, "Policy approved by an independent director.")}>Approve</button>
                <button type="button" onClick={() => void mutate({ action: "DECIDE_POLICY", policyId: p.id, decision: "REJECT" }, "Policy rejected.")}>Reject</button>
              </div> : <em>Awaiting independent director</em>}
            </div>)}
            {data.capabilities.prepare_payroll && data.preview ? <button type="button" onClick={() => { setDraft({}); setMode(mode === "IMPORT" ? null : "IMPORT"); }}>Import to approved payroll workflow</button> : null}
          </article>
        </div>
        <article className={styles.panel}>
          <div className={styles.heading}><h3>Salary slips and unpaid wage balances</h3><small>Employee-only download</small></div>
          {data.salary_slips.length ? data.salary_slips.map(slip => <div className={styles.record} key={slip.id}>
            <span><b>{slip.period} · {slip.code}</b><small>{money(slip.net_pay_minor)} net · confirmed {money(slip.confirmedMinor)} · outstanding {money(slip.balanceMinor)}</small></span>
            <div><em>{slip.status.replaceAll("_", " ")}</em><a href={"/api/office-salary-slips/" + slip.id + "/pdf"}><FileDown size={16}/>Download PDF</a></div>
          </div>) : <p className={styles.empty}>No approved issued payslips. Issuance requires an approved locked payroll result and independent payroll reviewer; bank preparation does not prove payment.</p>}
        </article>
        {mode ? <form className={styles.form} onSubmit={submit}>
          <div className={styles.heading}><h3>{mode === "CORRECTION" ? "Submit historical attendance evidence" : mode === "POLICY" ? "Propose effective-dated worktime policy" : "Import separately reviewed premiums"}</h3><button type="button" onClick={() => setMode(null)}>Cancel</button></div>
          {mode === "CORRECTION" ? <>
            <p>Backfill from 1 August 2026 using actual work records. Do not enter a six-hour default, fabricate past logins, or approve your own claim. For another employee, choose them from the Employee selector above.</p>
            <label>Actual start time (IST)<input type="datetime-local" required min="2026-08-01T00:00" value={draft.startAt || ""} onChange={e => setDraft({ ...draft, startAt: e.target.value })}/></label>
            <label>Actual end time (IST)<input type="datetime-local" required min="2026-08-01T00:00" value={draft.endAt || ""} onChange={e => setDraft({ ...draft, endAt: e.target.value })}/></label>
            <label>Unpaid break start (IST, optional)<input type="datetime-local" value={draft.breakStart || ""} onChange={e => setDraft({ ...draft, breakStart: e.target.value })}/></label>
            <label>Unpaid break end (IST, optional)<input type="datetime-local" value={draft.breakEnd || ""} onChange={e => setDraft({ ...draft, breakEnd: e.target.value })}/></label>
            <label>Evidence reference<input required minLength={5} placeholder="Attendance export / signed work record" value={draft.evidence || ""} onChange={e => setDraft({ ...draft, evidence: e.target.value })}/></label>
            <label>Reason<textarea required minLength={8} value={draft.reason || ""} onChange={e => setDraft({ ...draft, reason: e.target.value })}/></label>
          </> : null}
          {mode === "POLICY" ? <><label>Effective from<input required type="date" value={draft.effectiveFrom || ""} onChange={e => setDraft({ ...draft, effectiveFrom: e.target.value })}/></label><label>Signed policy / Board authority reference<input required minLength={12} value={draft.authority || ""} onChange={e => setDraft({ ...draft, authority: e.target.value })}/></label><p>The proposed rates remain inactive until a separate director authorises them. This does not retrospectively rewrite existing payslips.</p></> : null}
          {mode === "IMPORT" ? <><label>Monthly payroll period<select required value={draft.periodId || ""} onChange={e => setDraft({ ...draft, periodId: e.target.value })}><option value="">Select an existing editable period</option>{data.payroll_periods.filter(period => ["DRAFT","ATTENDANCE_READY","CALCULATED"].includes(period.status)).map(period => <option key={period.id} value={period.id}>{period.period_code} · {period.status}</option>)}</select></label><p>This creates only independently reviewable draft earnings adjustments, never a bank transfer or paid slip. If none is listed, open a monthly period in Payroll OS first.</p></> : null}
          <button type="submit" disabled={busy}>{busy ? <LoaderCircle size={17}/> : <CheckCircle2 size={17}/>}Submit for governed processing</button>
        </form> : null}
        <p className={styles.disclaimer}>{data.notice}</p>
      </>}
  </section>;
}
