"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CalendarClock, ChevronRight, CircleAlert, ClipboardCheck, FileDown, IdCard, ShieldCheck, Timer, Wallet } from "lucide-react";
import styles from "./office-employee-summary.module.css";

type RoleApplication = { id: string; snapshot: {
  label: string; department_code: string; primary_position_code: string;
  responsibilities: string[]; additional_roles: Array<{ position_code: string; department_code: string; responsibilities?: string[] }>;
  work_pattern: { daily_minutes: number; weekly_minutes: number };
}};
type Roles = {
  employee: { display_name?: string | null; job_title?: string | null; primary_department?: string | null; status: string };
  employment: { employment_code: string; status: string; start_date?: string | null } | null;
  applications: RoleApplication[];
  tasks: Array<{ required: boolean; status: string; label: string }>;
  functional_positions: Array<{ position_code: string; department_code: string; responsibilities: string[] }>;
};
type EmployeeIntake = { profile:{photo_storage_reference?:string|null;status?:"DRAFT"|"SUBMITTED"|"RETURNED"|"VERIFIED"}|null;permanent_employee_id:string|null };
type Worktime = {
  month: string;
  approved_monthly_gross_minor?: number | null;
  approved_gross_currency?: string | null;
  approved_policy: { id: string } | null;
  preview: { workedMinutes: number; weekdayOvertimeMinutes: number; weekendMinutes: number; nightMinutes: number; totalAdditionalEarningsMinor: number } | null;
  claims: Array<{ id: string; status: string }>;
  salary_slips: Array<{ id: string; period: string; code: string; status: string; net_pay_minor: number; confirmedMinor: number; balanceMinor: number }>;
};

async function fetchPrivate<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Verified profile records unavailable");
  return body as T;
}
function hours(minutes: number) { return (minutes / 60).toFixed(1).replace(/\.0$/, "") + " h"; }
function money(minor: number, currency: string) {
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100); }
  catch { return currency + " " + (minor / 100).toLocaleString("en-IN"); }
}

/** All data comes from the logged-in employee's existing governed services.
 * Missing approvals are not shown as salary credits, actual work or a payslip. */
export function OfficeEmployeeSummary() {
  const [roles, setRoles] = useState<Roles>();
  const [worktime, setWorktime] = useState<Worktime>();
  const [intake, setIntake] = useState<EmployeeIntake>();
  const [errors, setErrors] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    const answers = await Promise.allSettled([
      fetchPrivate<Roles>("/api/office-role-packages"),
      fetchPrivate<Worktime>("/api/office-worktime"),
      fetchPrivate<EmployeeIntake>("/api/office-employee-intake"),
    ]);
    if (signal?.aborted) return;
    const failures: string[] = [];
    if (answers[0].status === "fulfilled") setRoles(answers[0].value);
    else failures.push("Role and employment records: " + (answers[0].reason instanceof Error ? answers[0].reason.message : "Unavailable"));
    if (answers[1].status === "fulfilled") setWorktime(answers[1].value);
    else failures.push("Attendance and payroll evidence: " + (answers[1].reason instanceof Error ? answers[1].reason.message : "Unavailable"));
    if(answers[2].status==="fulfilled")setIntake(answers[2].value);
    // Existing role and worktime remain useful even if intake is not yet configured.
    setErrors(failures);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => void refresh(controller.signal));
    return () => { window.cancelAnimationFrame(frame); controller.abort(); };
  }, [refresh]);

  const latest = roles?.applications?.[0];
  // Display the real governed position/title. Never assign a personal
  // designation to other Founder or executive identities by inference.
  const title = latest?.snapshot.primary_position_code.replaceAll("_", " ") ||
    roles?.employee?.job_title || "Role pending assignment";
  const department = roles?.employee?.primary_department || "Unassigned";
  const approvedTasks = roles?.tasks?.filter(item => item.status === "VERIFIED").length ?? 0;
  const requiredTasks = roles?.tasks?.filter(item => item.required).length ?? 0;
  const slip = worktime?.salary_slips?.[0];
  const initials = (roles?.employee?.display_name || "KR").split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase();

  return <section className={styles.shell} aria-label="My verified employee profile">
    <header className={styles.header}>
      {intake?.profile?.status === "VERIFIED" && intake.profile.photo_storage_reference ?
        <Image unoptimized className={styles.avatar} width={48} height={48} alt="Verified employee profile photo"
          src="/api/office-employee-intake/photo" /> :
        <div className={styles.avatar} aria-hidden="true">{initials}</div>}
      <div className={styles.identity}>
        <small>MY KRAVIA OFFICE PROFILE</small>
        <h2>{roles?.employee?.display_name || "Employee profile"}</h2>
        <p>{department} · {title}</p>
        <span><IdCard size={14} aria-hidden="true"/>{intake?.permanent_employee_id || roles?.employment?.employment_code || "Employment verification pending"}</span>
      </div>
      <button type="button" className={styles.refresh} onClick={() => void refresh()}
        disabled={refreshing} aria-label="Refresh employee profile">Refresh</button>
    </header>
    {errors.length ? <div className={styles.error} role="status"><CircleAlert size={16}/>
      <span>{errors.join(" · ")}. Other verified records remain available.</span></div> : null}

    <div className={styles.cards}>
      <article><Timer size={18}/><small>Approved work · {worktime?.month || "this month"}</small>
        <strong>{worktime?.preview ? hours(worktime.preview.workedMinutes) : "Not verified"}</strong>
        <span>Time is counted only after independent approval.</span></article>
      <article><CalendarClock size={18}/><small>Approved overtime</small>
        <strong>{worktime?.preview ? hours(worktime.preview.weekdayOvertimeMinutes + worktime.preview.weekendMinutes) : "Not configured"}</strong>
        <span>Weekday and weekend work are recorded separately.</span></article>
      <article><Wallet size={18}/><small>Approved monthly gross</small>
        <strong>{typeof worktime?.approved_monthly_gross_minor === "number"
          ? money(worktime.approved_monthly_gross_minor, worktime.approved_gross_currency || "INR") : "Not approved"}</strong>
        <span>Estimated additional earnings: {worktime?.preview ? money(worktime.preview.totalAdditionalEarningsMinor, "INR") : "Not yet approved"}</span></article>
      <article><FileDown size={18}/><small>Issued salary slip</small>
        <strong>{slip ? slip.status.replaceAll("_"," ") : "Not issued"}</strong>
        <span>{slip ? "Verified payment " + money(slip.confirmedMinor, "INR") : "No slip or payment presumed"}</span></article>
    </div>
    <div className={styles.details}>
      <details>
        <summary><span><ClipboardCheck size={17}/> Responsibilities & work pattern</span><ChevronRight size={16}/></summary>
        <div className={styles.expanded}>
          {latest ? <><p>{latest.snapshot.label} · {hours(latest.snapshot.work_pattern.daily_minutes)} daily · {hours(latest.snapshot.work_pattern.weekly_minutes)} weekly</p>
            {latest.snapshot.responsibilities?.length ? <ul>{latest.snapshot.responsibilities.map((responsibility,i)=><li key={i}>{responsibility}</li>)}</ul>
              : <p>No verified responsibilities are assigned in this role package.</p>}</>
            : <p>Role duties will appear here after an authorised role package is applied.</p>}
          {roles?.functional_positions?.length ? <p>Additional roles: {roles.functional_positions.map(item => item.position_code.replaceAll("_"," ")).join(", ")}</p> : null}
        </div>
      </details>
      <details>
        <summary><span><BadgeCheck size={17}/> Onboarding evidence</span><ChevronRight size={16}/></summary>
        <div className={styles.expanded}>
          <p>{approvedTasks} verified onboarding steps{requiredTasks ? " · " + requiredTasks + " required" : ""}.</p>
          {roles?.tasks?.map((task,i)=><div className={styles.task} key={i}><span>{task.label}</span><b>{task.status.replaceAll("_"," ")}</b></div>)}
          {!roles?.tasks?.length ? <p>No reviewed onboarding steps yet.</p> : null}
          <p>HR reviews formal onboarding evidence in the governed employee record below.</p>
        </div>
      </details>
      <details>
        <summary><span><ShieldCheck size={17}/> Salary slips & verified payment evidence</span><ChevronRight size={16}/></summary>
        <div className={styles.expanded}>
          {worktime?.salary_slips?.length ? worktime.salary_slips.map(item => <div className={styles.slip} key={item.id}>
            <div><b>{item.period}</b><span>{item.status.replaceAll("_"," ")} · Net {money(item.net_pay_minor,"INR")} · Outstanding {money(item.balanceMinor,"INR")}</span></div>
            <a href={"/api/office-salary-slips/" + item.id + "/pdf"}><FileDown size={15}/> PDF</a>
          </div>) : <p>No approved salary slips have been issued.</p>}
        </div>
      </details>
    </div>
    <nav className={styles.shortcuts} aria-label="Personal records">
      <Link href="/office/worktime"><CalendarClock size={16}/> Detailed attendance & salary <ChevronRight size={15}/></Link>
      <Link href="/office/settings"><ShieldCheck size={16}/> My account & security <ChevronRight size={15}/></Link>
    </nav>
  </section>;
}
