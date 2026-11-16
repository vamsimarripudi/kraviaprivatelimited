"use client";
import {useOfficeLiveRefresh} from "@/lib/office/use-office-live-refresh";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardCheck, FileCheck2, RefreshCw, ShieldAlert, ShieldCheck, Users, Wallet } from "lucide-react";
import { useOfficeWorkspace } from "@/components/office-workspace-context";
import { capabilityCanAccessSection } from "@/lib/office/workspace-capabilities";
import { officeSections, roleCanAccessSection } from "@/lib/office/workspaces";
import type { HrReadinessAction, HrReadinessSnapshot } from "@/lib/office/hr-readiness";
import styles from "./office-hr-readiness.module.css";

const url = "/api/office-hr-readiness";

function readCount(value: number | null) {
  return value === null ? "Restricted" : value.toLocaleString("en-IN");
}

function priorityLabel(priority: HrReadinessAction["priority"]) {
  return priority === "P0" ? "Release blocker" : priority === "P1" ? "Action required" : "Follow-up";
}

export function OfficeHrReadiness() {
  const { identity, permissions } = useOfficeWorkspace();
  const [snapshot, setSnapshot] = useState<HrReadinessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = body && typeof body === "object" && "detail" in body ? (body as { detail?: unknown }).detail : null;
        throw new Error(typeof detail === "string" ? detail : "HR readiness is unavailable");
      }
      if (!body || typeof body !== "object" || !("metrics" in body) || !("actions" in body)) {
        throw new Error("HR readiness response is incomplete");
      }
      if (!signal?.aborted) setSnapshot(body as HrReadinessSnapshot);
    } catch (reason) {
      if (!signal?.aborted) setError(reason instanceof Error ? reason.message : "Unable to load current HR evidence");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useOfficeLiveRefresh(()=>reload(),{intervalMs:90000});
  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  function canNavigate(action: HrReadinessAction) {
    if (action.ownerOnly && !identity.roles.includes("OWNER")) return false;
    const slug = action.href.split("/")[2]?.split("#")[0] as keyof typeof officeSections;
    const section = officeSections[slug];
    return Boolean(section && roleCanAccessSection(section, identity.roles)
      && capabilityCanAccessSection("office", slug, identity.roles, permissions));
  }

  const m = snapshot?.metrics;
  const blockers = snapshot?.actions.filter(item => item.priority === "P0").length ?? 0;
  const tasks = snapshot?.actions.filter(item => item.priority !== "P0").length ?? 0;

  return <section className={styles.shell} aria-label="HR operational readiness" aria-busy={loading}>
    <header className={styles.hero}>
      <div className={styles.heading}>
        <p className={styles.eyebrow}><ShieldCheck size={13} aria-hidden="true"/> KRAVIA OFFICE / HUMAN RESOURCES</p>
        <h2>HR control center</h2>
        <p>Verified staff records, attendance exceptions, onboarding and payroll release controls in one place.</p>
      </div>
      <div className={styles.heroActions}>
        <div className={styles.freshness}>
          <span>Source</span><strong>Private Office database</strong>
          <small>{snapshot ? new Date(snapshot.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) + " IST" : "Not yet verified"}</small>
        </div>
        <button type="button" disabled={loading} onClick={() => void reload()} className={styles.refresh}>
          <RefreshCw size={15} aria-hidden="true" className={loading ? styles.spinning : ""}/>
          {loading ? "Reading records…" : "Refresh evidence"}
        </button>
      </div>
    </header>

    {error ? <div role="alert" className={styles.error}>
      <ShieldAlert size={18} aria-hidden="true"/>
      <div><strong>HR evidence could not be verified</strong><p>{error}. This is not a zero-record or ready state.</p></div>
      <button type="button" onClick={() => void reload()} disabled={loading}>Retry</button>
    </div> : null}

    {!snapshot && loading ? <div className={styles.loading} role="status">Checking employee records, worktime and HR policy configuration…</div> : null}

    {snapshot && m ? <>
      <div className={styles.metrics} aria-label="Live HR record totals">
        <article><Users size={17} aria-hidden="true"/><span>Active staff</span><strong>{m.activeEmployees}</strong><small>{m.plannedEmployees} planned</small></article>
        <article><CalendarClock size={17} aria-hidden="true"/><span>Attendance sessions</span><strong>{m.attendanceSessions}</strong><small>{m.openAttendanceSessions} currently open</small></article>
        <article><ClipboardCheck size={17} aria-hidden="true"/><span>Pending time reviews</span><strong>{m.pendingWorktimeReviews}</strong><small>Independent decisions needed</small></article>
        <article><FileCheck2 size={17} aria-hidden="true"/><span>Verified intake</span><strong>{m.verifiedIntakes}</strong><small>{m.draftIntakes} draft(s)</small></article>
        <article><Wallet size={17} aria-hidden="true"/><span>Staff with approved salary</span><strong>{readCount(m.approvedCompensationVersions)}</strong><small>Of {m.activeEmployees} active; effective today</small></article>
      </div>

      <div className={styles.summary} role="status">
        <div><ShieldAlert size={19} aria-hidden="true"/>
          <span><strong>{blockers} payroll/HR release blocker(s)</strong>
            <small>{tasks} additional action(s). Counts are evidence indicators, never legal clearance or permission to pay.</small>
          </span>
        </div>
        <Link href="/office/approvals">Authorized approvals <ArrowRight size={14} aria-hidden="true"/></Link>
      </div>

      <div className={styles.sectionHeading}>
        <div><p>CONTROLLED WORK QUEUE</p><h3>Resolve evidence gaps in priority order</h3></div>
        <span>{snapshot.actions.length} open follow-ups</span>
      </div>
      <div className={styles.actions}>
        {snapshot.actions.map((item) => <article key={item.id} className={styles.action} data-priority={item.priority}>
          <div className={styles.actionTop}>
            <span className={styles.priority} data-priority={item.priority}>{priorityLabel(item.priority)}</span>
            {item.requiresHumanEvidence ? <span className={styles.human}>Human approval required</span> : null}
          </div>
          <h4>{item.title}</h4>
          <p>{item.detail}</p>
          {canNavigate(item) ?
            <Link href={item.href} className={styles.actionLink} onClick={() => {
              const targetId = item.href.split("#")[1];
              const target = targetId ? document.getElementById(targetId) : null;
              if (target instanceof HTMLDetailsElement) target.open = true;
            }}>{item.action}<ArrowRight size={14} aria-hidden="true"/></Link> :
            <span className={styles.restricted}>Requires separately assigned module access</span>}
        </article>)}
      </div>

      <div className={styles.footerGrid}>
        <section>
          <h3>Daily HR checklist</h3>
          <ol>
            <li>Verify actual check-in, breaks and completed work sessions; open sessions from today may still be valid.</li>
            <li>Collect original evidence for time corrections, leave, holidays and genuine exceptions.</li>
            <li>Route each review to a different eligible person and retain the decision record.</li>
            <li>Review onboarding, appointment acceptance, employee ID and safe document retention.</li>
            <li>Request Finance/Owner decisions only after statutory, salary and bank evidence is complete.</li>
          </ol>
        </section>
        <section>
          <h3>Controlled release</h3>
          <p>No salary version, 2×/3× overtime, leave entitlement, bank credit or signed corporate act is created by this screen.</p>
          <p>Payroll requires verified employment dates, approved policies, actual attendance, an independently authorized maker–checker chain and bank confirmation.</p>
          <p className={styles.tiny}>{snapshot.notice}</p>
        </section>
      </div>
    </> : null}
  </section>;
}
