"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Banknote, Calculator, CheckCircle2, CircleAlert, FileClock, Landmark, LoaderCircle, Plus, RefreshCw, Scale, ShieldCheck, Users, X } from "lucide-react";
import styles from "./office-payroll-console.module.css";

type Capabilities = { read_run: boolean; read_compensation: boolean; read_rules: boolean; manage_compensation: boolean; manage_rules: boolean; prepare_run: boolean; review_run: boolean; approve_rules: boolean; prepare_payment: boolean };
type Identity = { user_id: string; display_name?: string | null; job_title?: string | null; primary_department?: string | null; status: string };
type Employment = { employment_id: string; employment_code: string; identity_user_id: string; relationship_type: string; status: string; start_date?: string | null; end_date?: string | null };
type Period = { id: string; period_code: string; period_kind: string; starts_on: string; ends_on: string; attendance_cutoff_at?: string | null; pay_date?: string | null; status: string; approval_request_id?: string | null; calculation_version: number; approved_at?: string | null };
type Compensation = { id: string; compensation_code: string; employment_id: string; employee_user_id: string; grade_code?: string | null; annual_ctc_minor: number; monthly_gross_minor: number; currency: string; components: unknown[]; effective_from: string; effective_to?: string | null; reason: string; status: string; approval_request_id?: string | null };
type Rule = { id: string; rule_code: string; version: number; rule_kind: string; title: string; jurisdiction: string; effective_from: string; effective_to?: string | null; configuration: Record<string, unknown>; source_reference: string; status: string; created_by: string };
type Attendance = { id: string; period_id: string; employment_id: string; employee_user_id: string; basis_units: number; payable_units: number; paid_leave_units: number; unpaid_leave_units: number; absence_units: number; unresolved_units: number; status: string; updated_at: string; prepared_by: string; reviewed_by?: string | null; reviewed_at?: string | null; source_snapshot?: { evidence_reference?: string; note?: string; source?: string; source_case_ids?: string[] } };
type Adjustment = { id: string; period_id: string; employment_id: string; employee_user_id: string; adjustment_kind: string; adjustment_code: string; label: string; amount_minor: number; currency: string; source_reference: string; status: string; created_by: string };
type Result = { id: string; period_id: string; employment_id: string; employee_user_id: string; currency: string; base_gross_minor: number; prorated_gross_minor: number; additional_earnings_minor: number; deductions_minor: number; employer_costs_minor: number; net_pay_minor: number; calculation_hash: string; calculation_version: number; status: string };
type Batch = { id: string; batch_code: string; period_id: string; currency: string; total_minor: number; employee_count: number; status: string; provider?: string | null; provider_batch_reference?: string | null; created_at: string };
type Entry = { id: string; batch_id: string; employee_user_id: string; amount_minor: number; currency: string; destination_masked?: string | null; status: string };
type Approval = { id: string; status: string; current_step_order?: number | null; due_at?: string | null };
type Payload = { actor: { user_id: string }; capabilities: Capabilities; employment: Employment[]; identities: Identity[]; periods: Period[]; rules: Rule[]; compensation: Compensation[]; attendance: Attendance[]; adjustments: Adjustment[]; results: Result[]; batches: Batch[]; entries: Entry[]; approvals: Approval[]; disclaimer: string };
type View = "periods" | "compensation" | "rules" | "batches";
type Modal =
  | { kind: "OPEN_PERIOD" }
  | { kind: "COMPENSATION" }
  | { kind: "ATTENDANCE"; period: Period; existing?: Attendance }
  | { kind: "REVIEW_ATTENDANCE"; period: Period; existing: Attendance }
  | { kind: "ADJUSTMENT"; period: Period }
  | { kind: "RULE" };

async function api<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-payroll", { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Payroll request failed");
  return body as T;
}
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()); }
function money(value: number | null | undefined, currency = "INR") { if (typeof value !== "number") return "—"; try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100); } catch { return `${currency} ${(value / 100).toLocaleString("en-IN")}`; } }
function date(value?: string | null) { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(parsed); }
function amountMinor(value: string) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : undefined; }

export function OfficePayrollConsole() {
  const [data, setData] = useState<Payload>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [view, setView] = useState<View>("periods");
  const [modal, setModal] = useState<Modal>();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function reload(message?: string) { const next = await api<Payload>(); setData(next); if (message) setNotice(message); }
  useEffect(() => { let alive = true; void api<Payload>().then((next) => { if (alive) setData(next); }).catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Unable to load payroll"); }); return () => { alive = false; }; }, []);

  const identityMap = useMemo(() => new Map((data?.identities ?? []).map((row) => [row.user_id, row])), [data?.identities]);
  const employmentMap = useMemo(() => new Map((data?.employment ?? []).map((row) => [row.employment_id, row])), [data?.employment]);
  const approvals = useMemo(() => new Map((data?.approvals ?? []).map((row) => [row.id, row])), [data?.approvals]);
  const activeEmployment = useMemo(() => (data?.employment ?? []).filter((row) => ["PLANNED", "ACTIVE", "ON_LEAVE"].includes(row.status)), [data?.employment]);

  function person(employmentId: string) { const employment = employmentMap.get(employmentId); const identity = employment ? identityMap.get(employment.identity_user_id) : undefined; return identity?.display_name || identity?.job_title || employment?.employment_code || "Employee"; }
  function open(kind: Modal["kind"], subject?: Period, existing?: Attendance) {
    if (kind === "OPEN_PERIOD") { setDraft({ kind: "MONTHLY" }); setModal({ kind }); }
    else if (kind === "COMPENSATION") { setDraft({ currency: "INR", components: "[]" }); setModal({ kind }); }
    else if (kind === "RULE") { setDraft({ kind: "COMPANY_POLICY", jurisdiction: "IN", configuration: "{}" }); setModal({ kind }); }
    else if (kind === "ATTENDANCE" && subject) {
      setDraft(existing ? {
        employment_id: existing.employment_id, basis_units: String(existing.basis_units),
        payable_units: String(existing.payable_units),
        paid_leave_units: String(existing.paid_leave_units),
        unpaid_leave_units: String(existing.unpaid_leave_units),
        absence_units: String(existing.absence_units),
        unresolved_units: String(existing.unresolved_units),
        evidence_reference: existing.source_snapshot?.evidence_reference || "",
        source_note: existing.source_snapshot?.note || "",
      } : { paid_leave_units: "0", unpaid_leave_units: "0", absence_units: "0", unresolved_units: "0" });
      setModal({ kind, period: subject, existing });
    }
    else if (kind === "REVIEW_ATTENDANCE" && subject && existing) {
      setDraft({ decision: existing.unresolved_units > 0 ? "REJECT" : "APPROVE", review_note: "" });
      setModal({ kind, period: subject, existing });
    }
    else if (kind === "ADJUSTMENT" && subject) { setDraft({ kind: "EARNING", currency: "INR" }); setModal({ kind, period: subject }); }
  }

  async function action(payload: Record<string, unknown>, message: string) {
    setBusy(true); setError(undefined);
    try { await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); await reload(message); setModal(undefined); setDraft({}); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Payroll update failed"); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!modal) return;
    if (modal.kind === "OPEN_PERIOD") return action({ action: "OPEN_PERIOD", kind: draft.kind, starts_on: draft.starts_on, ends_on: draft.ends_on, attendance_cutoff_at: draft.attendance_cutoff_at ? new Date(draft.attendance_cutoff_at).toISOString() : undefined, pay_date: draft.pay_date || undefined }, "Payroll period opened. No salary calculation or bank payment was executed.");
    if (modal.kind === "COMPENSATION") {
      const annual = amountMinor(draft.annual_ctc); const gross = amountMinor(draft.monthly_gross); if (annual === undefined || gross === undefined) return setError("Enter valid compensation amounts.");
      let components: unknown[]; try { const parsed = JSON.parse(draft.components || "[]"); if (!Array.isArray(parsed)) throw new Error(); components = parsed; } catch { return setError("Components must be a valid JSON array."); }
      return action({ action: "CREATE_COMPENSATION", employment_id: draft.employment_id, grade: draft.grade || undefined, annual_ctc_minor: annual, monthly_gross_minor: gross, currency: draft.currency || "INR", components, effective_from: draft.effective_from, reason: draft.reason }, "Compensation draft created. Historical compensation has not been overwritten.");
    }
    if (modal.kind === "RULE") {
      let configuration: Record<string, unknown>; try { const parsed = JSON.parse(draft.configuration || "{}"); if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(); configuration = parsed; } catch { return setError("Rule configuration must be a valid JSON object."); }
      return action({ action: "CREATE_RULE", rule_code: draft.rule_code, kind: draft.kind, title: draft.title, jurisdiction: draft.jurisdiction || "IN", effective_from: draft.effective_from, effective_to: draft.effective_to || undefined, configuration, source_reference: draft.source_reference }, "New payroll rule version drafted. It is not effective until authorised approval.");
    }
    if (modal.kind === "REVIEW_ATTENDANCE") {
      if (modal.existing.unresolved_units > 0 && draft.decision === "APPROVE") {
        return setError("Unresolved hours cannot be approved. Complete evidence or reject the snapshot for correction.");
      }
      if ((draft.review_note || "").trim().length < 12) return setError("An independent review note is required.");
      return action({ action: "REVIEW_ATTENDANCE", snapshot_id: modal.existing.id,
        decision: draft.decision, note: draft.review_note.trim() },
        draft.decision === "APPROVE" ? "Attendance independently reviewed. Payroll calculation remains a separate step." :
          "Attendance returned for evidence-backed correction; no salary or payment was issued.");
    }
    if (modal.kind === "ATTENDANCE") {
      const basis = Number(draft.basis_units);
      const payable = Number(draft.payable_units);
      const leave = Number(draft.paid_leave_units || "0");
      const unpaid = Number(draft.unpaid_leave_units || "0");
      const absent = Number(draft.absence_units || "0");
      const unresolved = Number(draft.unresolved_units || "0");
      if ([basis,payable,leave,unpaid,absent,unresolved].some(v => !Number.isFinite(v) || v < 0) ||
          basis <= 0 || leave > payable || Math.abs(payable + unpaid + absent + unresolved - basis) > 0.001) {
        return setError("Hours are inconsistent. Payable includes paid leave; payable + unpaid leave + absence + unresolved must equal the full basis.");
      }
      if ((draft.evidence_reference || "").trim().length < 5 ||
          (draft.source_note || "").trim().length < 8 ||
          (modal.existing && (draft.correction_reason || "").trim().length < 12)) {
        return setError("Provide a traceable source, meaningful review note and a correction reason when updating.");
      }
      return action({
        action: "SET_ATTENDANCE", period_id: modal.period.id, employment_id: draft.employment_id,
        basis_units: basis, payable_units: payable, paid_leave_units: leave,
        unpaid_leave_units: unpaid, absence_units: absent, unresolved_units: unresolved,
        expected_updated_at: modal.existing?.updated_at,
        correction_reason: modal.existing ? draft.correction_reason : undefined,
        source_snapshot: { source: "HR_EVIDENCE_REVIEW", evidence_reference: draft.evidence_reference,
          note: draft.source_note, correction_reason: draft.correction_reason || null },
      }, "Payroll attendance created or corrected with source evidence. Recalculate before submission; no bank action occurred.");
    }
    const amount = amountMinor(draft.amount); if (amount === undefined) return setError("Enter a valid adjustment amount.");
    return action({ action: "ADD_ADJUSTMENT", period_id: modal.period.id, employment_id: draft.employment_id, kind: draft.kind, code: draft.code, label: draft.label, amount_minor: amount, currency: draft.currency || "INR", source_reference: draft.source_reference, note: draft.note || undefined }, "Payroll adjustment drafted. A separate reviewer must approve it before calculation.");
  }

  if (error && !data) return <section className={styles.state}><CircleAlert /><div><h2>Payroll unavailable</h2><p>{error}</p></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Loading Payroll OS</h2><p>Resolving compensation, attendance snapshots, calculation versions and salary batches.</p></div></section>;

  const currentPeriods = data.periods.filter((row) => !["CLOSED", "CANCELLED"].includes(row.status)).length;
  const pendingComp = data.compensation.filter((row) => ["DRAFT", "PENDING_APPROVAL"].includes(row.status)).length;
  const draftAdjustments = data.adjustments.filter((row) => row.status === "DRAFT").length;
  const payrollEligible = data.employment.filter(row => ["ACTIVE","ON_LEAVE"].includes(row.status));
  const missingSalary = payrollEligible.filter(row => !data.compensation.some(
    salary => salary.employment_id === row.employment_id && salary.status === "APPROVED"
  ));
  const missingStart = payrollEligible.filter(row => !row.start_date);
  const waitingEmployment = data.employment.filter(row => row.status === "PLANNED");
  const reviewPending = data.attendance.filter(row => row.status === "DRAFT");
  const noApprovedRules = data.capabilities.read_rules && !data.rules.some(row => row.status === "APPROVED");

  return <section className={styles.shell}>
    <header className={styles.hero}><div><p>PAYROLL OS</p><h2>Compensation → attendance → review → payroll → salary batch.</h2><span>{data.disclaimer}</span></div><div className={styles.metrics}><article><b>{currentPeriods}</b><span>active periods</span></article><article><b>{pendingComp}</b><span>comp changes</span></article><article><b>{draftAdjustments}</b><span>adjustments to review</span></article></div></header>
    {(data.capabilities.read_run || data.capabilities.read_compensation) ?
      <article className={styles.card}>
        <header><div><h3>HR payroll readiness · verified records only</h3>
          <span>All issues below are calculated from the current Office database. Missing work is unresolved, not automatically unpaid.</span></div>
        </header>
        <div className={styles.grid}>
          <span>Active without approved salary<b>{missingSalary.length}</b></span>
          <span>Employment dates missing<b>{missingStart.length}</b></span>
          <span>Employment still planned<b>{waitingEmployment.length}</b></span>
          <span>Attendance awaiting review<b>{reviewPending.length}</b></span>
          <span>Approved payroll policies<b>{noApprovedRules ? "0 · configure" : "Review rules"}</b></span>
          <span>Payroll periods created<b>{data.periods.length}</b></span>
        </div>
        {missingSalary.length ? <div className={styles.review}>
          {missingSalary.map(row => <div key={row.employment_id}>
            <span>{person(row.employment_id)} · no APPROVED compensation version. The contract or appointment reference must be verified first.</span>
            {data.capabilities.manage_compensation ? <button type="button" disabled={busy}
              onClick={() => { setView("compensation"); setDraft({ employment_id: row.employment_id, currency: "INR", components: "[]" }); setModal({kind: "COMPENSATION"}); }}>
              Prepare salary draft
            </button> : null}
          </div>)}
        </div> : null}
        {waitingEmployment.length ? <p className={styles.warning}>
          Planned employment is deliberately excluded from payable payroll. Complete verified onboarding and authorized activation before salary preparation.
        </p> : null}
        {missingStart.length ? <p className={styles.warning}>
          Missing actual employment start dates require source documents. Never infer joining dates from a first login or create backdated attendance automatically.
        </p> : null}
        {noApprovedRules ? <p className={styles.warning}>
          No approved effective-dated statutory payroll rules are recorded. Obtain qualified finance review before processing PF, ESI, TDS, leave and benefit deductions.
        </p> : null}
      </article> : null}
    <div className={styles.tabs}>{(["periods", "compensation", "rules", "batches"] as View[]).map((item) => <button type="button" data-active={view === item} onClick={() => setView(item)} key={item}>{label(item)}</button>)}<div className={styles.actions}>{view === "periods" && data.capabilities.prepare_run ? <button type="button" onClick={() => open("OPEN_PERIOD")}><Plus /> Open period</button> : null}{view === "compensation" && data.capabilities.manage_compensation ? <button type="button" onClick={() => open("COMPENSATION")}><Plus /> Compensation</button> : null}{view === "rules" && data.capabilities.manage_rules ? <button type="button" onClick={() => open("RULE")}><Plus /> Rule version</button> : null}</div></div>
    {notice ? <div className={styles.notice}><CheckCircle2 />{notice}<button type="button" onClick={() => setNotice(undefined)} aria-label="Dismiss"><X /></button></div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}

    {view === "periods" ? <div className={styles.list}>{data.periods.map((period) => {
      const attendance = data.attendance.filter((row) => row.period_id === period.id);
      const adjustments = data.adjustments.filter((row) => row.period_id === period.id);
      const results = data.results.filter((row) => row.period_id === period.id && row.calculation_version === period.calculation_version && row.status !== "SUPERSEDED");
      const approval = period.approval_request_id ? approvals.get(period.approval_request_id) : undefined;
      const totalByCurrency = new Map<string, number>(); for (const result of results) totalByCurrency.set(result.currency, (totalByCurrency.get(result.currency) ?? 0) + result.net_pay_minor);
      return <article className={styles.card} key={period.id}><header><div><code>{period.period_code}</code><h3>{label(period.period_kind)} · {date(period.starts_on)} – {date(period.ends_on)}</h3><span>Pay date {date(period.pay_date)} · calculation v{period.calculation_version}</span></div><em data-status={period.status}>{label(period.status)}</em></header>
        <div className={styles.grid}><span>Attendance<b>{attendance.length} snapshot(s)</b></span><span>Unresolved<b>{attendance.filter((row) => Number(row.unresolved_units) > 0).length}</b></span><span>Adjustments<b>{adjustments.length} · {adjustments.filter((row) => row.status === "DRAFT").length} draft</b></span><span>Approval<b>{approval ? label(approval.status) : "Not submitted"}</b></span></div>
        {results.length ? <div className={styles.results}>{Array.from(totalByCurrency.entries()).map(([currency, total]) => <strong key={currency}>{money(total, currency)} net · {results.filter((row) => row.currency === currency).length} people</strong>)}</div> : null}
        {attendance.length ? <div className={styles.review}>{attendance.map(row =>
          <div key={row.id}>
            <span>{person(row.employment_id)} · payable {row.payable_units}/{row.basis_units} h · unresolved {row.unresolved_units} h · {label(row.status)} · prepared by {identityMap.get(row.prepared_by)?.display_name || "HR preparer"}{row.reviewed_by ? " · reviewed by " + (identityMap.get(row.reviewed_by)?.display_name || "independent reviewer") : " · awaiting independent review"}</span>
            {data.capabilities.prepare_run && ["DRAFT","ATTENDANCE_READY","CALCULATED"].includes(period.status) ?
              <button type="button" disabled={busy} onClick={() => open("ATTENDANCE", period, row)}>Edit / rectify hours</button> : null}
            {data.capabilities.review_run && row.status === "DRAFT" && row.prepared_by !== data.actor.user_id &&
              row.employee_user_id !== data.actor.user_id && ["DRAFT","ATTENDANCE_READY","CALCULATED"].includes(period.status) ?
              <button type="button" disabled={busy} onClick={() => open("REVIEW_ATTENDANCE", period, row)}>
                Review attendance
              </button> : null}
          </div>)}</div> : null}
        {adjustments.filter((row) => row.status === "DRAFT").length && data.capabilities.review_run ? <div className={styles.review}>{adjustments.filter((row) => row.status === "DRAFT").map((row) => <div key={row.id}><span>{row.adjustment_code} · {row.label} · {person(row.employment_id)} · {money(row.amount_minor, row.currency)}</span><button type="button" disabled={busy} onClick={() => void action({ action: "REVIEW_ADJUSTMENT", adjustment_id: row.id, decision: "APPROVE" }, "Payroll adjustment approved by an independent reviewer.")}>Approve</button><button type="button" disabled={busy} onClick={() => void action({ action: "REVIEW_ADJUSTMENT", adjustment_id: row.id, decision: "REJECT" }, "Payroll adjustment rejected.")}>Reject</button></div>)}</div> : null}
        <footer>{data.capabilities.prepare_run && ["DRAFT", "ATTENDANCE_READY", "CALCULATED"].includes(period.status) ? <><button type="button" onClick={() => open("ATTENDANCE", period)}><Users /> Attendance</button><button type="button" onClick={() => open("ADJUSTMENT", period)}><Plus /> Adjustment</button></> : null}{data.capabilities.prepare_run && ["ATTENDANCE_READY", "CALCULATED"].includes(period.status) ? <button type="button" disabled={busy} onClick={() => void action({ action: "CALCULATE", period_id: period.id }, "Payroll recalculated into a new immutable calculation version.")}><Calculator /> Calculate</button> : null}{data.capabilities.prepare_run && period.status === "CALCULATED" ? <button type="button" disabled={busy} onClick={() => void action({ action: "SUBMIT_PAYROLL", period_id: period.id }, "Payroll submitted for independent review and owner approval.")}><ShieldCheck /> Submit</button> : null}{period.approval_request_id && period.status === "PENDING_REVIEW" ? <button type="button" disabled={busy} onClick={() => void action({ action: "SYNC_PAYROLL", period_id: period.id }, "Payroll approval state synchronized.")}><RefreshCw /> Sync approval</button> : null}{data.capabilities.prepare_payment && period.status === "APPROVED" ? <button type="button" disabled={busy} onClick={() => void action({ action: "PREPARE_SALARY_BATCH", period_id: period.id }, "Salary batch prepared. No bank transfer has been executed.")}><Banknote /> Prepare salary batch</button> : null}</footer>
      </article>;
    })}{!data.periods.length ? <div className={styles.empty}><FileClock /><b>No payroll periods</b><span>Open a real payroll period; the system does not fabricate employee salary records.</span></div> : null}</div> : null}

    {view === "compensation" ? <div className={styles.list}>{data.compensation.map((row) => <article className={styles.card} key={row.id}><header><div><code>{row.compensation_code}</code><h3>{person(row.employment_id)}</h3><span>{row.grade_code || "No grade"} · effective {date(row.effective_from)}{row.effective_to ? ` → ${date(row.effective_to)}` : ""}</span></div><em data-status={row.status}>{label(row.status)}</em></header><div className={styles.grid}><span>Annual CTC<b>{money(row.annual_ctc_minor, row.currency)}</b></span><span>Monthly gross<b>{money(row.monthly_gross_minor, row.currency)}</b></span><span>Components<b>{Array.isArray(row.components) ? row.components.length : 0}</b></span><span>Approval<b>{row.approval_request_id ? label(approvals.get(row.approval_request_id)?.status || "Pending") : "Not submitted"}</b></span></div><p>{row.reason}</p><footer>{data.capabilities.manage_compensation && ["DRAFT", "REJECTED"].includes(row.status) ? <button type="button" disabled={busy} onClick={() => void action({ action: "SUBMIT_COMPENSATION", compensation_id: row.id }, "Compensation version submitted. Old compensation remains unchanged until approval becomes effective.")}><ShieldCheck /> Submit change</button> : null}{row.approval_request_id && row.status === "PENDING_APPROVAL" ? <button type="button" disabled={busy} onClick={() => void action({ action: "SYNC_COMPENSATION", compensation_id: row.id }, "Compensation approval state synchronized without rewriting history.")}><RefreshCw /> Sync approval</button> : null}</footer></article>)}{!data.compensation.length ? <div className={styles.empty}><Scale /><b>No compensation versions</b><span>Create an effective-dated compensation version instead of typing salary directly into documents.</span></div> : null}</div> : null}

    {view === "rules" ? <div className={styles.list}>{data.rules.map((rule) => <article className={styles.card} key={rule.id}><header><div><code>{rule.rule_code} · v{rule.version}</code><h3>{rule.title}</h3><span>{label(rule.rule_kind)} · {rule.jurisdiction} · effective {date(rule.effective_from)}</span></div><em data-status={rule.status}>{label(rule.status)}</em></header><p>Source: {rule.source_reference}</p><div className={styles.ruleConfig}><code>{JSON.stringify(rule.configuration)}</code></div><footer>{data.capabilities.approve_rules && rule.status === "DRAFT" && rule.created_by !== data.actor.user_id ? <><button type="button" disabled={busy} onClick={() => void action({ action: "REVIEW_RULE", rule_id: rule.id, decision: "APPROVE", note: "Owner-approved payroll rule version" }, "Payroll rule version approved with its effective date and source reference.")}>Approve</button><button type="button" disabled={busy} onClick={() => void action({ action: "REVIEW_RULE", rule_id: rule.id, decision: "REJECT", note: "Rule version rejected" }, "Payroll rule version retired without becoming effective.")}>Reject</button></> : null}</footer></article>)}{!data.rules.length ? <div className={styles.empty}><Scale /><b>No payroll rule versions</b><span>No PF, ESI, tax, proration or leave rate is invented. Add only source-backed versions.</span></div> : null}</div> : null}

    {view === "batches" ? <div className={styles.list}>{data.batches.map((batch) => { const entries = data.entries.filter((row) => row.batch_id === batch.id); return <article className={styles.card} key={batch.id}><header><div><code>{batch.batch_code}</code><h3>{money(batch.total_minor, batch.currency)} · {batch.employee_count} employees</h3><span>{batch.provider || "Bank adapter not selected"} · created {date(batch.created_at)}</span></div><em data-status={batch.status}>{label(batch.status)}</em></header><div className={styles.entries}>{entries.map((row) => <div key={row.id}><span>{identityMap.get(row.employee_user_id)?.display_name || "Employee"}</span><b>{money(row.amount_minor, row.currency)}</b><em>{label(row.status)}</em><small>{row.destination_masked || "Destination not yet verified"}</small></div>)}</div><div className={styles.bankGuard}><Landmark /><span>This batch is a governed payment instruction set. KRAVIA has not executed a bank transfer merely by creating it.</span></div></article>; })}{!data.batches.length ? <div className={styles.empty}><Banknote /><b>No salary payment batches</b><span>A batch can only be prepared after a payroll run completes independent approval.</span></div> : null}</div> : null}

    {modal ? <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && setModal(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><header><div><p>{modal.kind}</p><h3>{modal.kind === "OPEN_PERIOD" ? "Open payroll period" : modal.kind === "COMPENSATION" ? "New compensation version" : modal.kind === "ATTENDANCE" ? `${modal.existing ? "Correct" : "Add"} attendance · ${modal.period.period_code}` : modal.kind === "REVIEW_ATTENDANCE" ? `Independent attendance review · ${modal.period.period_code}` : modal.kind === "ADJUSTMENT" ? `Adjustment · ${modal.period.period_code}` : "Payroll rule version"}</h3></div><button type="button" onClick={() => setModal(undefined)} aria-label="Close"><X /></button></header>
      {modal.kind === "OPEN_PERIOD" ? <><label>Period type<select value={draft.kind || "MONTHLY"} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>{["MONTHLY", "OFF_CYCLE", "FINAL_SETTLEMENT"].map((v) => <option key={v}>{v}</option>)}</select></label><div className={styles.two}><label>Starts<input type="date" required value={draft.starts_on || ""} onChange={(e) => setDraft({ ...draft, starts_on: e.target.value })} /></label><label>Ends<input type="date" required value={draft.ends_on || ""} onChange={(e) => setDraft({ ...draft, ends_on: e.target.value })} /></label></div><div className={styles.two}><label>Attendance cutoff<input type="datetime-local" value={draft.attendance_cutoff_at || ""} onChange={(e) => setDraft({ ...draft, attendance_cutoff_at: e.target.value })} /></label><label>Pay date<input type="date" value={draft.pay_date || ""} onChange={(e) => setDraft({ ...draft, pay_date: e.target.value })} /></label></div></> : null}
      {modal.kind === "COMPENSATION" ? <><label>Employment<select required value={draft.employment_id || ""} onChange={(e) => setDraft({ ...draft, employment_id: e.target.value })}><option value="">Select employee</option>{activeEmployment.map((row) => <option key={row.employment_id} value={row.employment_id}>{row.employment_code} · {person(row.employment_id)}</option>)}</select></label><div className={styles.three}><label>Annual CTC<input required inputMode="decimal" value={draft.annual_ctc || ""} onChange={(e) => setDraft({ ...draft, annual_ctc: e.target.value })} /></label><label>Monthly gross<input required inputMode="decimal" value={draft.monthly_gross || ""} onChange={(e) => setDraft({ ...draft, monthly_gross: e.target.value })} /></label><label>Currency<input required minLength={3} maxLength={3} value={draft.currency || "INR"} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} /></label></div><div className={styles.two}><label>Grade<input value={draft.grade || ""} onChange={(e) => setDraft({ ...draft, grade: e.target.value })} /></label><label>Effective from<input type="date" required value={draft.effective_from || ""} onChange={(e) => setDraft({ ...draft, effective_from: e.target.value })} /></label></div><label>Reason<textarea required minLength={3} value={draft.reason || ""} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></label><label>Structured components JSON<textarea value={draft.components || "[]"} onChange={(e) => setDraft({ ...draft, components: e.target.value })} /></label><p className={styles.warning}>This creates a new effective-dated version. It does not rewrite historic payslips or previous compensation.</p></> : null}
      {modal.kind === "ATTENDANCE" ? <><label>Employment<select required disabled={Boolean(modal.existing)} value={draft.employment_id || ""} onChange={(e) => setDraft({ ...draft, employment_id: e.target.value })}><option value="">Select employee</option>{activeEmployment.filter(row => ["ACTIVE","ON_LEAVE"].includes(row.status)).map((row) => <option key={row.employment_id} value={row.employment_id}>{row.employment_code} · {person(row.employment_id)}</option>)}</select></label><div className={styles.three}><label>Basis hours<input type="number" step="0.001" min="0.001" required value={draft.basis_units || ""} onChange={(e) => setDraft({ ...draft, basis_units: e.target.value })} /></label><label>Payable hours (including approved paid leave)<input type="number" step="0.001" min="0" required value={draft.payable_units || ""} onChange={(e) => setDraft({ ...draft, payable_units: e.target.value })} /></label><label>Paid leave hours<input type="number" step="0.001" min="0" value={draft.paid_leave_units || "0"} onChange={(e) => setDraft({ ...draft, paid_leave_units: e.target.value })} /></label></div><div className={styles.three}><label>Unpaid leave hours<input type="number" step="0.001" min="0" value={draft.unpaid_leave_units || "0"} onChange={(e) => setDraft({ ...draft, unpaid_leave_units: e.target.value })} /></label><label>Verified absence hours<input type="number" step="0.001" min="0" value={draft.absence_units || "0"} onChange={(e) => setDraft({ ...draft, absence_units: e.target.value })} /></label><label>Unresolved hours<input type="number" step="0.001" min="0" value={draft.unresolved_units || "0"} onChange={(e) => setDraft({ ...draft, unresolved_units: e.target.value })} /></label></div><label>Evidence reference<input required minLength={5} placeholder="Approved timesheet / leave record / holiday policy" value={draft.evidence_reference || ""} onChange={(e) => setDraft({ ...draft, evidence_reference: e.target.value })}/></label>
      <label>Source/review note<textarea required minLength={8} value={draft.source_note || ""} onChange={(e) => setDraft({ ...draft, source_note: e.target.value })} /></label>
      {modal.existing ? <label>Reason for correction<textarea required minLength={12} value={draft.correction_reason || ""} onChange={(e) => setDraft({ ...draft, correction_reason: e.target.value })}/></label> : null}
      <p className={styles.warning}>Payable hours include paid leave. Missing attendance is not automatic unpaid absence. Correcting this snapshot invalidates the previous payroll calculation and requires recalculation; bank transfers are never automatic.</p></> : null}
      {modal.kind === "REVIEW_ATTENDANCE" ? <>
        <p className={styles.warning}>This evidence belongs to {person(modal.existing.employment_id)} and was prepared by {identityMap.get(modal.existing.prepared_by)?.display_name || "another HR user"}. Review actual time, leave and holiday evidence before deciding. No self-approval is permitted.</p>
        <div className={styles.grid}>
          <span>Basis hours<b>{modal.existing.basis_units}</b></span>
          <span>Payable including paid leave<b>{modal.existing.payable_units}</b></span>
          <span>Approved paid leave<b>{modal.existing.paid_leave_units}</b></span>
          <span>Unresolved<b>{modal.existing.unresolved_units}</b></span>
        </div>
        <p>Evidence: {modal.existing.source_snapshot?.evidence_reference ||
           (modal.existing.source_snapshot?.source_case_ids || []).join(", ") ||
           modal.existing.source_snapshot?.source || "Review source record"}</p>
        <label>Decision<select value={draft.decision || "REJECT"} onChange={e => setDraft({ ...draft, decision: e.target.value })}>
          <option value="APPROVE" disabled={modal.existing.unresolved_units > 0}>Approve verified attendance</option>
          <option value="REJECT">Return for correction</option>
        </select></label>
        <label>Evidence review note<textarea required minLength={12} value={draft.review_note || ""}
          onChange={e => setDraft({ ...draft, review_note: e.target.value })}/></label>
      </> : null}
      {modal.kind === "ADJUSTMENT" ? <><label>Employment<select required value={draft.employment_id || ""} onChange={(e) => setDraft({ ...draft, employment_id: e.target.value })}><option value="">Select employee</option>{activeEmployment.map((row) => <option key={row.employment_id} value={row.employment_id}>{row.employment_code} · {person(row.employment_id)}</option>)}</select></label><div className={styles.two}><label>Kind<select value={draft.kind || "EARNING"} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>{["EARNING", "DEDUCTION", "EMPLOYER_COST"].map((v) => <option key={v}>{v}</option>)}</select></label><label>Code<input required value={draft.code || ""} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} /></label></div><label>Label<input required value={draft.label || ""} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label><div className={styles.two}><label>Amount<input required inputMode="decimal" value={draft.amount || ""} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></label><label>Currency<input required minLength={3} maxLength={3} value={draft.currency || "INR"} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} /></label></div><label>Source reference<input required minLength={3} value={draft.source_reference || ""} onChange={(e) => setDraft({ ...draft, source_reference: e.target.value })} /></label><label>Note<textarea value={draft.note || ""} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label></> : null}
      {modal.kind === "RULE" ? <><div className={styles.two}><label>Rule code<input required minLength={2} value={draft.rule_code || ""} onChange={(e) => setDraft({ ...draft, rule_code: e.target.value.toUpperCase() })} /></label><label>Kind<select value={draft.kind || "COMPANY_POLICY"} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>{["COMPANY_POLICY", "PRORATION", "LEAVE", "STATUTORY", "TAX", "BENEFIT", "OTHER"].map((v) => <option key={v}>{v}</option>)}</select></label></div><label>Title<input required minLength={3} value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label><div className={styles.three}><label>Jurisdiction<input required value={draft.jurisdiction || "IN"} onChange={(e) => setDraft({ ...draft, jurisdiction: e.target.value.toUpperCase() })} /></label><label>Effective from<input type="date" required value={draft.effective_from || ""} onChange={(e) => setDraft({ ...draft, effective_from: e.target.value })} /></label><label>Effective to<input type="date" value={draft.effective_to || ""} onChange={(e) => setDraft({ ...draft, effective_to: e.target.value })} /></label></div><label>Authoritative/source reference<input required minLength={3} value={draft.source_reference || ""} onChange={(e) => setDraft({ ...draft, source_reference: e.target.value })} /></label><label>Configuration JSON<textarea value={draft.configuration || "{}"} onChange={(e) => setDraft({ ...draft, configuration: e.target.value })} /></label><p className={styles.warning}>Do not invent a PF, ESI, TDS, minimum-wage or other statutory rate here. Source-backed rules must be reviewed before approval.</p></> : null}
      <footer><button type="button" onClick={() => setModal(undefined)} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <CheckCircle2 />} Confirm</button></footer></form></div> : null}
  </section>;
}
