"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, BanknoteArrowDown, Building2, CircleAlert, Landmark, LoaderCircle, RefreshCw, SearchCheck, ShieldCheck, X } from "lucide-react";
import styles from "./office-banking.module.css";

type Mode = "banking" | "reconciliation";

type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  masked_account: string;
  ifsc?: string | null;
  currency: string;
  purpose?: string | null;
  status: string;
};

type BankTransaction = {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  amount: string;
  direction: "CREDIT" | "DEBIT";
  reference: string;
  description?: string | null;
  match_status: string;
  matched_payment_id?: string | null;
  source: string;
};

type Dialog =
  | { kind: "ACCOUNT" }
  | { kind: "TRANSACTION" };

type Draft = Record<string, string>;

async function runtime<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-runtime/" + path, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.detail === "string" ? body.detail : "Banking runtime request failed");
  }
  return body as T;
}

function mutationHeaders() {
  return {
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  };
}

function money(value: string | number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(parsed);
}

function normalizeMaskedAccount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/[*xX•]/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length <= 4) return "••••" + digits;
  return "••••" + digits.slice(-4);
}

export function OfficeBankingWorkspace({
  mode,
  canRegisterAccount,
  canImportTransaction,
  canAutoMatch,
}: {
  mode: Mode;
  canRegisterAccount: boolean;
  canImportTransaction: boolean;
  canAutoMatch: boolean;
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>();
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const fetchRecords = useCallback(() => Promise.all([
    runtime<BankAccount[]>("banking/accounts"),
    runtime<BankTransaction[]>("banking/transactions"),
  ]), []);

  const applyRecords = useCallback(([nextAccounts, nextTransactions]: [BankAccount[], BankTransaction[]]) => {
    setAccounts(nextAccounts);
    setTransactions(nextTransactions);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      applyRecords(await fetchRecords());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load banking records");
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
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load banking records");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyRecords, fetchRecords]);

  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const exceptionRows = useMemo(
    () => transactions.filter((row) => row.match_status !== "MATCHED"),
    [transactions],
  );
  const visibleRows = mode === "reconciliation" ? exceptionRows : transactions;
  const creditTotal = transactions
    .filter((row) => row.direction === "CREDIT")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const debitTotal = transactions
    .filter((row) => row.direction === "DEBIT")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

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
      if (dialog.kind === "ACCOUNT") {
        await runtime("banking/accounts", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({
            bank_name: draft.bank_name,
            account_name: draft.account_name,
            masked_account: normalizeMaskedAccount(draft.masked_account || ""),
            ifsc: draft.ifsc || undefined,
            purpose: draft.purpose || undefined,
          }),
        });
        await refreshAfter("Masked bank account reference registered in the canonical finance runtime.");
      } else {
        await runtime("banking/transactions", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({
            bank_account_id: draft.bank_account_id,
            transaction_date: draft.transaction_date,
            amount: Number(draft.amount || "0"),
            direction: draft.direction || "CREDIT",
            reference: draft.reference,
            description: draft.description || undefined,
            source: draft.source || "MANUAL_IMPORT",
          }),
        });
        await refreshAfter("Bank transaction evidence recorded. No bank transfer was initiated.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Banking action failed");
    } finally {
      setBusy(false);
    }
  }

  async function autoMatch(transaction: BankTransaction) {
    setBusy(true);
    setError(undefined);
    try {
      const result = await runtime<{ id: string; match_status: string; payment_id?: string; candidate_count?: number }>(
        "banking/transactions/" + encodeURIComponent(transaction.id) + "/auto-match",
        { method: "POST", headers: mutationHeaders(), body: "{}" },
      );
      const message = result.match_status === "MATCHED"
        ? "Transaction matched to one canonical received payment."
        : `No deterministic single match was available. Review remains required${typeof result.candidate_count === "number" ? ` (${result.candidate_count} candidate(s))` : ""}.`;
      await refreshAfter(message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Auto-match failed");
    } finally {
      setBusy(false);
    }
  }

  return <section className={styles.shell}>
    <header className={styles.hero}>
      <div>
        <p>{mode === "banking" ? "BANKING · EVIDENCE" : "RECONCILIATION · EXCEPTIONS"}</p>
        <h2>{mode === "banking"
          ? "Maintain masked bank references and imported transaction evidence without storing account secrets."
          : "Resolve explicit bank-to-payment matching exceptions without inventing a bank feed or silent reconciliation."}</h2>
        <span>{mode === "banking"
          ? "This workspace records finance evidence only. It does not initiate bank transfers, expose full account numbers, or imply a live bank connection."
          : "Auto-match only confirms a unique credit transaction/payment match. Ambiguous or unmatched records stay visible for human review."}</span>
      </div>
      <div className={styles.guard}>
        <ShieldCheck />
        <span>Execution boundary</span>
        <b>No bank-side payment execution</b>
      </div>
    </header>

    <div className={styles.toolbar}>
      <button type="button" onClick={() => void load()} disabled={loading || busy}><RefreshCw /> Refresh</button>
      {mode === "banking" && canRegisterAccount ? <button type="button" disabled={busy} onClick={() => { setDraft({}); setDialog({ kind: "ACCOUNT" }); }}><Building2 /> Register account</button> : null}
      {mode === "banking" && canImportTransaction ? <button type="button" disabled={busy || !accounts.length} onClick={() => { setDraft({ direction: "CREDIT", source: "MANUAL_IMPORT", transaction_date: new Date().toISOString().slice(0, 10) }); setDialog({ kind: "TRANSACTION" }); }}><BanknoteArrowDown /> Add transaction evidence</button> : null}
    </div>

    {notice ? <div className={styles.notice}><BadgeCheck />{notice}</div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}

    {loading ? <div className={styles.state}><LoaderCircle className={styles.spin} />Loading canonical banking evidence…</div> : <>
      <div className={styles.metrics}>
        <article><span>Registered accounts</span><b>{accounts.length}</b></article>
        <article><span>Recorded credits</span><b>{money(creditTotal)}</b></article>
        <article><span>Recorded debits</span><b>{money(debitTotal)}</b></article>
        <article><span>Reconciliation exceptions</span><b>{exceptionRows.length}</b></article>
      </div>

      {mode === "banking" ? <section className={styles.panel}>
        <header className={styles.panelHead}>
          <div><p>BANK REFERENCES</p><h3>Masked company accounts</h3></div>
          <span>Only masked account references are stored here. Credentials, OTPs, PINs and full account numbers do not belong in KRAVIA Office.</span>
        </header>
        <div className={styles.accountGrid}>
          {accounts.map((account) => <article key={account.id} className={styles.accountCard}>
            <Landmark />
            <div><small>{account.bank_name}</small><h4>{account.account_name}</h4><b>{account.masked_account}</b><span>{account.purpose || "No purpose note"}{account.ifsc ? " · " + account.ifsc : ""}</span></div>
            <em data-status={account.status}>{account.status}</em>
          </article>)}
          {!accounts.length ? <div className={styles.empty}>No masked bank references have been registered.</div> : null}
        </div>
      </section> : null}

      <section className={styles.panel}>
        <header className={styles.panelHead}>
          <div><p>{mode === "banking" ? "TRANSACTION EVIDENCE" : "MATCHING QUEUE"}</p><h3>{mode === "banking" ? "Imported / manually recorded transactions" : "Unmatched and review-required records"}</h3></div>
          <span>{mode === "banking" ? "The source is recorded on each row. Manual evidence is not presented as a live bank feed." : "Only credits can currently be deterministically auto-matched to canonical received payments."}</span>
        </header>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Date</th><th>Bank</th><th>Direction</th><th>Amount</th><th>Reference</th><th>Source</th><th>Match</th><th>Action</th></tr></thead>
            <tbody>
              {visibleRows.map((row) => {
                const account = accountMap.get(row.bank_account_id);
                return <tr key={row.id}>
                  <td>{date(row.transaction_date)}</td>
                  <td><strong>{account?.bank_name || row.bank_account_id}</strong><span>{account?.masked_account || "Unknown account"}</span></td>
                  <td><em data-direction={row.direction}>{row.direction}</em></td>
                  <td>{money(row.amount, account?.currency || "INR")}</td>
                  <td><strong>{row.reference}</strong><span>{row.description || "—"}</span></td>
                  <td>{row.source}</td>
                  <td><em data-match={row.match_status}>{row.match_status}</em>{row.matched_payment_id ? <span>{row.matched_payment_id}</span> : null}</td>
                  <td>{canAutoMatch && row.direction === "CREDIT" && row.match_status !== "MATCHED"
                    ? <button type="button" disabled={busy} onClick={() => void autoMatch(row)}><SearchCheck /> Auto-match</button>
                    : <span>—</span>}</td>
                </tr>;
              })}
              {!visibleRows.length ? <tr><td colSpan={8}><div className={styles.empty}>{mode === "reconciliation" ? "No reconciliation exceptions remain." : "No bank transaction evidence has been recorded."}</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>}

    {dialog ? <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && setDialog(undefined)}>
      <form className={styles.dialog} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><small>CANONICAL BANKING ACTION</small><h3>{dialog.kind === "ACCOUNT" ? "Register masked bank account" : "Record transaction evidence"}</h3></div><button type="button" aria-label="Close" onClick={() => setDialog(undefined)} disabled={busy}><X /></button></header>
        {dialog.kind === "ACCOUNT" ? <>
          <div className={styles.two}>
            <label>Bank name<input required minLength={2} value={draft.bank_name || ""} onChange={(event) => setDraft({ ...draft, bank_name: event.target.value })} /></label>
            <label>Account name<input required minLength={2} value={draft.account_name || ""} onChange={(event) => setDraft({ ...draft, account_name: event.target.value })} /></label>
          </div>
          <label>Masked account reference<input required minLength={4} placeholder="••••8782" value={draft.masked_account || ""} onChange={(event) => setDraft({ ...draft, masked_account: event.target.value })} /><small>If digits are entered, only the last four are sent as a masked reference.</small></label>
          <div className={styles.two}>
            <label>IFSC / routing reference<input value={draft.ifsc || ""} onChange={(event) => setDraft({ ...draft, ifsc: event.target.value })} /></label>
            <label>Purpose<input value={draft.purpose || ""} onChange={(event) => setDraft({ ...draft, purpose: event.target.value })} /></label>
          </div>
          <p className={styles.warning}>Do not enter internet-banking credentials, OTPs, PINs, card data or unmasked account secrets.</p>
        </> : <>
          <label>Bank account<select required value={draft.bank_account_id || ""} onChange={(event) => setDraft({ ...draft, bank_account_id: event.target.value })}><option value="">Select account</option>{accounts.filter((account) => account.status === "ACTIVE").map((account) => <option key={account.id} value={account.id}>{account.bank_name} · {account.masked_account}</option>)}</select></label>
          <div className={styles.three}>
            <label>Date<input required type="date" value={draft.transaction_date || ""} onChange={(event) => setDraft({ ...draft, transaction_date: event.target.value })} /></label>
            <label>Direction<select required value={draft.direction || "CREDIT"} onChange={(event) => setDraft({ ...draft, direction: event.target.value })}><option value="CREDIT">Credit</option><option value="DEBIT">Debit</option></select></label>
            <label>Amount<input required type="number" min="0.01" step="0.01" value={draft.amount || ""} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>
          </div>
          <label>Bank / external reference<input required minLength={2} maxLength={200} value={draft.reference || ""} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} /></label>
          <label>Description<textarea value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label>Source<select value={draft.source || "MANUAL_IMPORT"} onChange={(event) => setDraft({ ...draft, source: event.target.value })}><option value="MANUAL_IMPORT">Manual import / entry</option><option value="CSV_IMPORT">CSV import evidence</option><option value="PROVIDER_EXPORT">Provider export evidence</option></select></label>
          <p className={styles.warning}>This records evidence from an external source. It does not move money or claim a live bank-feed connection.</p>
        </>}
        <footer><button type="button" onClick={() => setDialog(undefined)} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <BadgeCheck />}Confirm</button></footer>
      </form>
    </div> : null}
  </section>;
}
