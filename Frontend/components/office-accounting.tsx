"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, BookOpenCheck, CircleAlert, KeyRound, LoaderCircle, LockKeyhole, RefreshCw, Scale, UnlockKeyhole, X } from "lucide-react";
import styles from "./office-accounting.module.css";

type TrialBalanceAccount = {
  account_code: string;
  account_name: string;
  account_type: string;
  debit: string;
  credit: string;
  net_paise: number;
};

type TrialBalance = {
  balanced: boolean;
  total_debit: string;
  total_credit: string;
  accounts: TrialBalanceAccount[];
  control_note: string;
};

type PeriodLock = {
  id: string;
  period_start: string;
  period_end: string;
  lock_type: "ACCOUNTING" | "TAX" | "BOTH";
  status: "LOCKED" | "OPEN";
  reason: string;
  locked_by: string;
  locked_at?: string | null;
  unlock_approval_id?: string | null;
  unlocked_by?: string | null;
  unlocked_at?: string | null;
};

type Approval = {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  requested_by: string;
  required_role: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason?: string | null;
  decided_by?: string | null;
  decision_reason?: string | null;
};

type Dialog =
  | { kind: "LOCK" }
  | { kind: "REQUEST_UNLOCK"; lock: PeriodLock }
  | { kind: "DECIDE"; lock: PeriodLock; approval: Approval; decision: "approve" | "reject" };

type Draft = Record<string, string>;

async function runtime<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-runtime/" + path, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.detail === "string" ? body.detail : "Accounting runtime request failed");
  }
  return body as T;
}

function mutationHeaders() {
  return {
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  };
}

function money(value: string | number) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function netMoney(paise: number) {
  return money(Number(paise || 0) / 100);
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function latestUnlockApprovals(approvals: Approval[]) {
  const byLock = new Map<string, Approval>();
  for (const approval of approvals) {
    if (
      approval.action_type === "ACCOUNTING_PERIOD_UNLOCK" &&
      approval.entity_type === "accounting_period_lock" &&
      !byLock.has(approval.entity_id)
    ) {
      byLock.set(approval.entity_id, approval);
    }
  }
  return byLock;
}

export function OfficeAccountingWorkspace({
  canManageLocks,
  canApproveUnlock,
}: {
  canManageLocks: boolean;
  canApproveUnlock: boolean;
}) {
  const [trial, setTrial] = useState<TrialBalance>();
  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>();
  const [draft, setDraft] = useState<Draft>({});
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const fetchRecords = useCallback(() => Promise.all([
    runtime<TrialBalance>("accounting/trial-balance"),
    runtime<PeriodLock[]>("accounting/period-locks"),
    runtime<Approval[]>("approvals"),
  ]), []);

  const applyRecords = useCallback(([nextTrial, nextLocks, nextApprovals]: [TrialBalance, PeriodLock[], Approval[]]) => {
    setTrial(nextTrial);
    setLocks(nextLocks);
    setApprovals(nextApprovals);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      applyRecords(await fetchRecords());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load accounting controls");
    } finally {
      setLoading(false);
    }
  }, [applyRecords, fetchRecords]);

  useEffect(() => {
    let active = true;
    void fetchRecords()
      .then((records) => {
        if (active) applyRecords(records);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load accounting controls");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyRecords, fetchRecords]);

  const approvalByLock = useMemo(() => latestUnlockApprovals(approvals), [approvals]);
  const activeLocks = locks.filter((lock) => lock.status === "LOCKED");
  const openLocks = locks.filter((lock) => lock.status === "OPEN");

  async function refreshAfter(message: string) {
    setNotice(message);
    setDialog(undefined);
    setDraft({});
    await load();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    setBusy(true);
    setError(undefined);
    try {
      if (dialog.kind === "LOCK") {
        await runtime("accounting/period-locks", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({
            period_start: draft.period_start,
            period_end: draft.period_end,
            lock_type: draft.lock_type || "BOTH",
            reason: draft.reason,
          }),
        });
        await refreshAfter("Accounting period lock created and enforced by the canonical finance runtime.");
      } else if (dialog.kind === "REQUEST_UNLOCK") {
        await runtime(`accounting/period-locks/${encodeURIComponent(dialog.lock.id)}/unlock-request`, {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({ reason: draft.reason }),
        });
        await refreshAfter("Unlock request created. Independent approval is required before the period can reopen.");
      } else {
        await runtime(`approvals/${encodeURIComponent(dialog.approval.id)}/${dialog.decision}`, {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({ reason: draft.reason }),
        });
        await refreshAfter(`Unlock request ${dialog.decision === "approve" ? "approved" : "rejected"} through the canonical maker-checker workflow.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Accounting control action failed");
    } finally {
      setBusy(false);
    }
  }

  async function executeUnlock(lock: PeriodLock, approval: Approval) {
    setBusy(true);
    setError(undefined);
    try {
      await runtime(`accounting/period-locks/${encodeURIComponent(lock.id)}/unlock`, {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({ approval_id: approval.id }),
      });
      await refreshAfter("Approved period unlock applied. The period is open for future authorised postings.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Approved unlock could not be applied");
    } finally {
      setBusy(false);
    }
  }

  function openLockDialog() {
    setDraft({ lock_type: "BOTH" });
    setDialog({ kind: "LOCK" });
  }

  return <section className={styles.shell}>
    <header className={styles.hero}>
      <div>
        <p>ACCOUNTING · LEDGER CONTROL</p>
        <h2>Balance the operational subledger and control which accounting or tax periods accept new postings.</h2>
        <span>Period locks are enforced before ledger posting. Reopening a locked period requires a separate approval; this workspace does not imply statutory close certification.</span>
      </div>
      <div className={styles.balance} data-balanced={trial?.balanced === true}>
        <Scale />
        <span>Trial balance</span>
        <b>{trial ? (trial.balanced ? "Balanced" : "Exception") : "Loading"}</b>
      </div>
    </header>

    <div className={styles.toolbar}>
      <button type="button" onClick={() => void load()} disabled={loading || busy}><RefreshCw /> Refresh</button>
      {canManageLocks ? <button type="button" onClick={openLockDialog} disabled={busy}><LockKeyhole /> Lock period</button> : null}
    </div>

    {notice ? <div className={styles.notice}><BadgeCheck />{notice}</div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}

    {loading ? <div className={styles.state}><LoaderCircle className={styles.spin} />Loading canonical accounting records…</div> : <>
      <div className={styles.metrics}>
        <article><span>Total debits</span><b>{money(trial?.total_debit || 0)}</b></article>
        <article><span>Total credits</span><b>{money(trial?.total_credit || 0)}</b></article>
        <article><span>Chart accounts</span><b>{trial?.accounts.length || 0}</b></article>
        <article><span>Active period locks</span><b>{activeLocks.length}</b></article>
      </div>

      <section className={styles.panel}>
        <header className={styles.panelHead}>
          <div><p>PERIOD CONTROL</p><h3>Accounting & tax posting locks</h3></div>
          <span>Maker-checker reopening is enforced by the backend even when an approval control is visible here.</span>
        </header>
        <div className={styles.lockGrid}>
          {locks.map((lock) => {
            const approval = approvalByLock.get(lock.id);
            return <article className={styles.lockCard} key={lock.id}>
              <header>
                <div><small>{lock.lock_type}</small><h4>{lock.period_start} → {lock.period_end}</h4></div>
                <em data-status={lock.status}>{lock.status}</em>
              </header>
              <p>{lock.reason}</p>
              <dl>
                <div><dt>Locked by</dt><dd>{lock.locked_by}</dd></div>
                <div><dt>Locked at</dt><dd>{dateTime(lock.locked_at)}</dd></div>
                {lock.unlocked_by ? <div><dt>Unlocked by</dt><dd>{lock.unlocked_by}</dd></div> : null}
                {lock.unlocked_at ? <div><dt>Unlocked at</dt><dd>{dateTime(lock.unlocked_at)}</dd></div> : null}
              </dl>
              {approval ? <div className={styles.approval}>
                <KeyRound /><div><b>Unlock approval · {approval.status}</b><span>{approval.id} · requires {approval.required_role}</span>{approval.decided_by ? <span>Decided by {approval.decided_by}</span> : null}</div>
              </div> : null}
              {lock.status === "LOCKED" ? <div className={styles.actions}>
                {canManageLocks && (!approval || approval.status === "REJECTED") ? <button type="button" disabled={busy} onClick={() => { setDraft({}); setDialog({ kind: "REQUEST_UNLOCK", lock }); }}><UnlockKeyhole /> Request unlock</button> : null}
                {approval?.status === "PENDING" && canApproveUnlock ? <>
                  <button type="button" disabled={busy} onClick={() => { setDraft({}); setDialog({ kind: "DECIDE", lock, approval, decision: "approve" }); }}><BadgeCheck /> Approve</button>
                  <button type="button" disabled={busy} onClick={() => { setDraft({}); setDialog({ kind: "DECIDE", lock, approval, decision: "reject" }); }}><CircleAlert /> Reject</button>
                </> : null}
                {approval?.status === "APPROVED" && canManageLocks ? <button type="button" disabled={busy} onClick={() => void executeUnlock(lock, approval)}><UnlockKeyhole /> Apply approved unlock</button> : null}
              </div> : null}
            </article>;
          })}
          {!locks.length ? <div className={styles.empty}>No accounting or tax period locks have been recorded.</div> : null}
        </div>
        {openLocks.length ? <p className={styles.history}>{openLocks.length} historical lock{openLocks.length === 1 ? "" : "s"} reopened through controlled evidence.</p> : null}
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHead}>
          <div><p>TRIAL BALANCE</p><h3>All recorded journal postings</h3></div>
          <span>{trial?.control_note || "Operational subledger."}</span>
        </header>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Account</th><th>Type</th><th>Debit</th><th>Credit</th><th>Net</th></tr></thead>
            <tbody>
              {(trial?.accounts || []).map((account) => <tr key={account.account_code}>
                <td><strong>{account.account_code}</strong><span>{account.account_name}</span></td>
                <td>{account.account_type}</td>
                <td>{money(account.debit)}</td>
                <td>{money(account.credit)}</td>
                <td>{netMoney(account.net_paise)}</td>
              </tr>)}
              {!trial?.accounts.length ? <tr><td colSpan={5}><div className={styles.empty}>No chart accounts are available from the canonical ledger.</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>}

    {dialog ? <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && setDialog(undefined)}>
      <form className={styles.dialog} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><small>ACCOUNTING CONTROL</small><h3>{dialog.kind === "LOCK" ? "Lock accounting period" : dialog.kind === "REQUEST_UNLOCK" ? "Request period unlock" : `${dialog.decision === "approve" ? "Approve" : "Reject"} unlock request`}</h3></div>
          <button type="button" aria-label="Close" onClick={() => setDialog(undefined)} disabled={busy}><X /></button>
        </header>
        {dialog.kind === "LOCK" ? <>
          <div className={styles.two}>
            <label>Period start<input required type="date" value={draft.period_start || ""} onChange={(event) => setDraft({ ...draft, period_start: event.target.value })} /></label>
            <label>Period end<input required type="date" value={draft.period_end || ""} onChange={(event) => setDraft({ ...draft, period_end: event.target.value })} /></label>
          </div>
          <label>Control scope<select required value={draft.lock_type || "BOTH"} onChange={(event) => setDraft({ ...draft, lock_type: event.target.value })}><option value="BOTH">Accounting + tax</option><option value="ACCOUNTING">Accounting only</option><option value="TAX">Tax only</option></select></label>
          <label>Reason<textarea required minLength={3} maxLength={2000} value={draft.reason || ""} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} /></label>
          <p className={styles.warning}>An overlapping active lock for the same control scope is rejected. New postings inside the locked period fail closed.</p>
        </> : <>
          <p>{dialog.lock.period_start} → {dialog.lock.period_end} · {dialog.lock.lock_type}</p>
          <label>{dialog.kind === "REQUEST_UNLOCK" ? "Why must this period reopen?" : "Decision reason"}<textarea required minLength={3} maxLength={2000} value={draft.reason || ""} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} /></label>
          {dialog.kind === "DECIDE" ? <p className={styles.warning}>The requester cannot approve or reject their own unlock request. The backend enforces this independently of the interface.</p> : <p className={styles.warning}>Requesting an unlock does not reopen the period. Independent approval must be recorded first.</p>}
        </>}
        <footer><button type="button" onClick={() => setDialog(undefined)} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <BookOpenCheck />}Confirm</button></footer>
      </form>
    </div> : null}
  </section>;
}
