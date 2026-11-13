"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, FileCheck2, RefreshCcw, ShieldCheck } from "lucide-react";
import styles from "./office-exit-governance.module.css";

type Person = { user_id: string; display_name?: string | null; status: string };
type Contact = {
  status: string; consent_source: string; evidence_reference: string;
  recipient: string | null; recorded_by: string; recorded_at: string;
  reviewed_by: string | null; reviewed_at: string | null; expires_at: string;
  version: number;
};
type ExitCase = { id: string; status: string; opened_by: string; opened_at: string; verified_at?: string | null; payroll_result_id: string; offboarding_request_id: string };
type Request = { id: string; status: string; created_at: string };
type Payroll = { id: string; status: string; period_id: string; currency: string; net_pay_minor: number };
type Summary = {
  employee: Person;
  contact: Contact | null;
  cases: ExitCase[];
  requests: Request[];
  payroll: Payroll[];
  capabilities: { people: boolean; owner: boolean; finance: boolean };
  note: string;
};
type Action = "RECORD_CONTACT" | "REVIEW_CONTACT" | "REVOKE_CONTACT" | "OPEN_SETTLEMENT" | "VERIFY_SETTLEMENT" | "RECORD_COMPLETION";
type Draft = { email: string; source: string; evidence_reference: string; reason: string; approve: string; requestId: string; payrollId: string; caseId: string };
const empty: Draft = { email: "", source: "SIGNED_EXIT_FORM", evidence_reference: "", reason: "", approve: "true", requestId: "", payrollId: "", caseId: "" };

async function api(path: string, options?: RequestInit): Promise<Summary | { saved: boolean }> {
  const response = await fetch(path, { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Exit governance is not available");
  return body;
}

const actions: Array<{ action: Action; title: string }> = [
  { action: "RECORD_CONTACT", title: "Record explicit contact consent" },
  { action: "REVIEW_CONTACT", title: "Independent Owner contact review" },
  { action: "REVOKE_CONTACT", title: "Revoke contact consent" },
  { action: "OPEN_SETTLEMENT", title: "Open verified payroll settlement case" },
  { action: "VERIFY_SETTLEMENT", title: "Independently verify full settlement" },
  { action: "RECORD_COMPLETION", title: "Record final offboarding completion" },
];

export function OfficeExitGovernance({ people, actorId }: { people: Person[]; actorId: string }) {
  const [employeeId, setEmployeeId] = useState(people[0]?.user_id || "");
  const [data, setData] = useState<Summary>();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<Action>("RECORD_CONTACT");
  const [draft, setDraft] = useState<Draft>(empty);

  async function reload(id: string) {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const next = await api("/api/office-exit-governance?employee_user_id=" + encodeURIComponent(id));
      setData(next as Summary);
    } catch (caught) {
      setData(undefined);
      setError(caught instanceof Error ? caught.message : "Unable to verify employee exit records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!employeeId && people[0]?.user_id) setEmployeeId(people[0].user_id);
  }, [employeeId, people]);

  useEffect(() => {
    if (!employeeId) return;
    let active = true;
    api("/api/office-exit-governance?employee_user_id=" + encodeURIComponent(employeeId))
      .then((next) => { if (active) { setData(next as Summary); setError(""); } })
      .catch((caught: unknown) => { if (active) { setData(undefined); setError(caught instanceof Error ? caught.message : "Governance unavailable"); } });
    return () => { active = false; };
  }, [employeeId]);

  function enabled(next: Action): boolean {
    if (!data) return false;
    const owner = data.capabilities.owner;
    const contact = data.contact;
    const separate = contact?.recorded_by !== actorId;
    if (next === "RECORD_CONTACT") return data.capabilities.people;
    if (next === "REVIEW_CONTACT") return owner && contact?.status === "PENDING" && separate;
    if (next === "REVOKE_CONTACT") return data.capabilities.people && Boolean(contact && contact.status !== "REVOKED");
    if (next === "OPEN_SETTLEMENT") return data.capabilities.people && data.capabilities.finance &&
      data.requests.some((row) => ["APPROVED", "FULFILLED"].includes(row.status)) && data.payroll.length > 0;
    if (next === "VERIFY_SETTLEMENT") return owner && data.cases.some((row) => row.status === "OPEN" && row.opened_by !== actorId);
    return owner && data.cases.some((row) => row.status === "VERIFIED" && row.opened_by !== actorId);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId || !enabled(action) || draft.reason.trim().length < 12) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const payload: Record<string, unknown> = {
        action, employee_user_id: employeeId, reason: draft.reason.trim(),
      };
      switch (action) {
        case "RECORD_CONTACT":
          Object.assign(payload, { email: draft.email.trim(), source: draft.source, evidence_reference: draft.evidence_reference.trim() });
          break;
        case "REVIEW_CONTACT":
          payload.approve = draft.approve === "true";
          break;
        case "OPEN_SETTLEMENT":
          Object.assign(payload, { offboarding_request_id: draft.requestId, payroll_result_id: draft.payrollId });
          break;
        case "VERIFY_SETTLEMENT":
        case "RECORD_COMPLETION":
          payload.settlement_case_id = draft.caseId;
          break;
      }
      await api("/api/office-exit-governance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNotice("Governed exit evidence recorded. No email or payment was sent.");
      setDraft(empty);
      await reload(employeeId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Independent exit action was denied");
    } finally {
      setBusy(false);
    }
  }

  if (!people.length) return null;
  return <section className={styles.shell} aria-label="Offboarding contacts and settlements">
    <header className={styles.heading}>
      <ShieldCheck aria-hidden="true" size={22}/>
      <div><h3>Exit governance and notifications</h3><p>Independent consent, verified payroll and signed-document evidence</p></div>
      <button type="button" disabled={busy || loading} onClick={() => void reload(employeeId)} aria-label="Refresh verified exit records"><RefreshCcw size={17}/></button>
    </header>
    <label className={styles.field}>Employee<select value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setData(undefined); setNotice(""); setDraft(empty); }}>
      {people.map((person) => <option key={person.user_id} value={person.user_id}>{person.display_name || person.user_id} · {person.status}</option>)}
    </select></label>
    {loading ? <p className={styles.help}>Verifying source records…</p> : null}
    {error ? <p className={styles.error} role="alert"><CircleAlert size={17}/>{error}</p> : null}
    {notice ? <p className={styles.notice} role="status"><CheckCircle2 size={17}/>{notice}</p> : null}
    {data ? <>
      <div className={styles.cards}>
        <div><small>Contact</small><b>{data.contact?.status || "Not documented"}</b><span>{data.contact?.recipient || "No independently verified address"}</span></div>
        <div><small>Evidence version</small><b>{data.contact?.version || "—"}</b><span>{data.contact?.expires_at ? "Expires " + new Date(data.contact.expires_at).toLocaleDateString("en-IN") : "No expiry recorded"}</span></div>
        <div><small>Settlement cases</small><b>{data.cases.length}</b><span>{data.cases.some((item) => item.status === "VERIFIED") ? "Independently verified case exists" : "Awaiting verified full bank credits"}</span></div>
      </div>
      <p className={styles.help}>{data.note} Create and independently approve HR_RELIEVING/HR_EXPERIENCE documents in Document Studio; no signed document or personal address is fabricated.</p>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <label className={styles.field}>Governed action
          <select value={action} onChange={(event) => { setAction(event.target.value as Action); setDraft(empty); }}>
            {actions.map((item) => <option key={item.action} value={item.action} disabled={!enabled(item.action)}>{item.title}</option>)}
          </select>
        </label>
        {action === "RECORD_CONTACT" ? <>
          <label className={styles.field}>Former employee contact email<input type="email" required maxLength={320} autoComplete="off" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="Explicitly consented personal email"/></label>
          <label className={styles.field}>Consent evidence source<select value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })}>
            <option value="SIGNED_EXIT_FORM">Signed exit form</option>
            <option value="VERIFIED_EMPLOYEE_REPLY">Verified employee reply</option>
            <option value="SIGNED_EMPLOYMENT_CONSENT">Signed employment consent</option>
          </select></label>
          <label className={styles.field}>Immutable evidence reference<input required minLength={12} maxLength={500} value={draft.evidence_reference} onChange={(event) => setDraft({ ...draft, evidence_reference: event.target.value })}/></label>
        </> : null}
        {action === "REVIEW_CONTACT" ? <label className={styles.field}>Independent decision<select value={draft.approve} onChange={(event) => setDraft({ ...draft, approve: event.target.value })}><option value="true">Verify documented consent</option><option value="false">Reject consent</option></select></label> : null}
        {action === "OPEN_SETTLEMENT" ? <>
          <label className={styles.field}>Approved offboarding request<select required value={draft.requestId} onChange={(event) => setDraft({ ...draft, requestId: event.target.value })}><option value="">Select request</option>{data.requests.filter((row) => ["APPROVED","FULFILLED"].includes(row.status)).map((row) => <option value={row.id} key={row.id}>{row.id.slice(0, 8)} · {row.status}</option>)}</select></label>
          <label className={styles.field}>Locked payroll result<select required value={draft.payrollId} onChange={(event) => setDraft({ ...draft, payrollId: event.target.value })}><option value="">Select payroll evidence</option>{data.payroll.map((row) => <option key={row.id} value={row.id}>{row.id.slice(0, 8)} · {row.currency} · {row.net_pay_minor} minor units</option>)}</select></label>
        </> : null}
        {action === "VERIFY_SETTLEMENT" || action === "RECORD_COMPLETION" ? <label className={styles.field}>Settlement case<select required value={draft.caseId} onChange={(event) => setDraft({ ...draft, caseId: event.target.value })}><option value="">Select case</option>{data.cases.filter((row) => action === "VERIFY_SETTLEMENT" ? row.status === "OPEN" : row.status === "VERIFIED").map((row) => <option key={row.id} value={row.id}>{row.id.slice(0, 8)} · {row.status}</option>)}</select></label> : null}
        <label className={styles.field}>Audited rationale<textarea required minLength={12} maxLength={500} rows={3} value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="Describe actual consent, reviewed bank evidence or approved completion"/></label>
        <button className={styles.submit} disabled={!enabled(action) || busy || draft.reason.trim().length < 12} type="submit"><FileCheck2 size={17}/>{busy ? "Recording decision…" : "Record governed evidence"}</button>
      </form>
    </> : null}
  </section>;
}
