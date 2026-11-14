"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, CircleAlert, LoaderCircle, ShieldCheck, X } from "lucide-react";
import styles from "./office-department-handover.module.css";

type Department = { code: string; label: string };
type Person = { user_id: string; display_name?: string | null };
type Ownership = { department_code: string; owner_user_id: string; previous_owner_user_id?: string | null; version: number };
type Transfer = { id: string; department_code: string; from_owner_user_id: string; to_owner_user_id: string; status: string; reason: string; decided_at?: string | null };
type Response = {
  actor: { user_id: string; founder: boolean };
  departments: Department[];
  ownership: Ownership[];
  transfers: Transfer[];
  people: Person[];
};

async function api<T>(body?: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/office-departments", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Department ownership request failed");
  return data as T;
}

export function OfficeDepartmentHandover({ mode = "manage" }: { mode?: "manage" | "recipient" }) {
  const router = useRouter();
  const [data, setData] = useState<Response>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Department>();
  const [recipient, setRecipient] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [reauthRequired, setReauthRequired] = useState(false);
  const refresh = useCallback(async () => {
    const fresh = await api<Response>();
    setData(fresh);
    return fresh;
  }, []);
  useEffect(() => {
    if (mode !== "recipient" || !data) return;
    const incoming = data.transfers.filter(t => t.to_owner_user_id === data.actor.user_id);
    const latest = incoming.filter(t => t.status === "ACCEPTED")
      .map(t => t.decided_at || t.id).sort().join("|");
    const noPending = !incoming.some(t => t.status === "PENDING");
    let acknowledged = false;
    try {
      acknowledged = window.sessionStorage.getItem("kravia.office.transfer.reauth." + data.actor.user_id) === latest;
    } catch { /* Browser may disallow session storage. */ }
    const frame = window.requestAnimationFrame(() => {
      setReauthRequired(noPending && latest.length > 0 && !acknowledged);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode, data]);

  async function signOutForHandover() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/office-auth/sign-out", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Sign-out failed. Use the account menu and retry.");
      if (data) {
        const latest = data.transfers.filter(t => t.to_owner_user_id === data.actor.user_id && t.status === "ACCEPTED")
          .map(t => t.decided_at || t.id).sort().join("|");
        try { window.sessionStorage.setItem("kravia.office.transfer.reauth." + data.actor.user_id, latest); }
        catch { /* No storage persistence required for security. */ }
      }
      router.replace("/office/login");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign out");
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    void api<Response>().then((value) => { if (active) setData(value); }).catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : "Unable to read handover records");
    });
    return () => { active = false; };
  }, []);

  async function transact(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api(body);
      await refresh();
      // Accepting a department changes the authority matrix; refresh the server
      // layout to rebuild the sidebar from effective grants without a new login.
      if (body.action === "ACCEPT") router.refresh();
      setSelected(undefined); setRecipient(""); setReason("");
      setNotice(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete handover");
    } finally { setBusy(false); }
  }
  function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !recipient || reason.trim().length < 12) return;
    void transact({ action: "PROPOSE", department: selected.code, recipient, reason }, "Handover proposed. No access has changed until the recipient accepts.");
  }
  if (!data) return <section className={styles.shell}><h2>Department ownership</h2><p>{error || "Loading permanent authority records…"}</p></section>;

  const named = (id?: string | null) => data.people.find((p) => p.user_id === id)?.display_name || (id === data.actor.user_id ? "You" : "Assigned employee");
  // Recipient mode is personal self-service, not an access-administration console.
  // Only transfers addressed to this signed-in person can be shown or accepted.
  const incoming = data.transfers.filter(item => item.to_owner_user_id === data.actor.user_id);
  const visibleTransfers = mode === "recipient" ? incoming : data.transfers;
  const departments = mode === "recipient"
    ? data.departments.filter(dept => incoming.some(item => item.department_code === dept.code))
    : data.departments;
  const pendingCount = incoming.filter(item => item.status === "PENDING").length;
  return <section className={styles.shell}>
    <header>
      <span className={styles.eyebrow}>{mode === "recipient" ? "PERSONAL INBOX · VERIFIED RECIPIENT" : "PERMANENT DEPARTMENT AUTHORITY"}</span>
      <h2>{mode === "recipient" ? "My department transfers" : "Transfer responsibility, not passwords"}</h2>
      <p>{mode === "recipient"
        ? `You have ${pendingCount} department transfer${pendingCount === 1 ? "" : "s"} awaiting your decision. Review each department and accept only responsibilities you are authorized and prepared to take over. Acceptance immediately changes the department's operational authority.`
        : "Each handover requires recipient acceptance. The former owner retains read access but loses departmental write and approval capabilities. No temporary grants are created."}</p>
    </header>
    {notice ? <p className={styles.notice}><ShieldCheck size={17}/>{notice}</p> : null}
    {error ? <p className={styles.error}><CircleAlert size={17}/>{error}</p> : null}
    {mode === "recipient" && reauthRequired && pendingCount === 0 ? <div role="status" className={styles.reauth}>
      <div><ShieldCheck size={20} aria-hidden="true"/><span>
        <strong>All incoming department transfers accepted</strong>
        <small>Your accepted ownership is now effective in the backend. Sign out and sign in again to reload your updated role authority, Finance navigation and other department permissions.</small>
      </span></div>
      <button type="button" disabled={busy} onClick={() => void signOutForHandover()}>
        Sign out to refresh access
      </button>
    </div> : null}
    {departments.length ? <div className={styles.grid}>{departments.map((dept) => {
      const record = data.ownership.find((item) => item.department_code === dept.code);
      const pending = visibleTransfers.find((item) => item.department_code === dept.code && item.status === "PENDING");
      const accepted = visibleTransfers.find((item) => item.department_code === dept.code && item.status === "ACCEPTED");
      const currentOwner = record?.owner_user_id;
      const canPropose = mode === "manage" && ((!record && data.actor.founder) || currentOwner === data.actor.user_id);
      const canAccept = pending?.to_owner_user_id === data.actor.user_id;
      const canCancel = mode === "manage" && pending && (pending.from_owner_user_id === data.actor.user_id || canAccept);
      return <article key={dept.code}>
        <div className={styles.row}><strong>{dept.label}</strong><small>{record ? "v" + record.version : "Founder authority"}</small></div>
        <p>Owner: {currentOwner ? named(currentOwner) : "Founder (not yet delegated)"}</p>
        {pending ? <p className={styles.pending}><ArrowRightLeft size={15}/>From {named(pending.from_owner_user_id)} · Awaiting {named(pending.to_owner_user_id)} to accept</p> : null}
        {pending && mode === "recipient" ? <p>Reason: {pending.reason}</p> : null}
        {accepted && mode === "recipient" && !pending ? <p><ShieldCheck size={15}/> Transfer accepted. Your current access remains subject to separate permission and appointment rules.</p> : null}
        <div className={styles.actions}>
          {canPropose && !pending ? <button type="button" onClick={() => setSelected(dept)} disabled={busy}><ArrowRightLeft size={16}/>Transfer</button> : null}
          {pending && canAccept ? <button type="button" disabled={busy} onClick={() => {
            if (window.confirm(`Accept permanent ownership of ${dept.label}? The former owner will lose departmental write/approval authority. Confirm only if you understand the transfer responsibilities.`)) {
              void transact({ action: "ACCEPT", transfer_id: pending.id }, "Ownership accepted. Previous owner's departmental write access is revoked.");
            }
          }}><Check size={16}/>Review & accept</button> : null}
          {pending && canCancel ? <button type="button" disabled={busy} onClick={() => void transact({ action: "CANCEL", transfer_id: pending.id }, "Handover cancelled with no permission change.")}><X size={16}/>Cancel</button> : null}
        </div>
      </article>;
    })}</div> : <p className={styles.empty}>{mode === "recipient"
      ? "No department transfers are assigned to your identity. New incoming transfers will appear here automatically."
      : "No departments assigned. Pending handovers will be listed here when directed to you."}</p>}
    {selected && mode === "manage" ? <form className={styles.form} onSubmit={propose}>
      <h3>Transfer {selected.label}</h3>
      <p>The recipient must sign into their own account and accept. This will permanently remove your write access to this department.</p>
      <label>New owner<select required value={recipient} onChange={(e) => setRecipient(e.target.value)} disabled={busy}>
        <option value="">Select active team member</option>
        {data.people.filter((p) => p.user_id !== data.actor.user_id).map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name || p.user_id}</option>)}
      </select></label>
      <label>Reason for transfer<textarea required minLength={12} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Responsibilities and authority being transferred" disabled={busy}/></label>
      <div className={styles.actions}><button type="submit" disabled={busy || !recipient || reason.trim().length < 12}>{busy ? <LoaderCircle size={16}/> : <Check size={16}/>}Propose transfer</button><button type="button" onClick={() => setSelected(undefined)} disabled={busy}>Cancel</button></div>
    </form> : null}
  </section>;
}
