"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleAlert, Clock3, LoaderCircle, PlayCircle, RefreshCw, Send, ShieldCheck, WalletCards, X } from "lucide-react";
import styles from "./office-payments.module.css";

type PaymentInstruction = {
  id: string;
  direction: "PAYOUT" | "COLLECTION";
  expense_id?: string | null;
  allocation_id?: string | null;
  vendor_id?: string | null;
  mandate_id?: string | null;
  amount: string;
  provider: string;
  provider_destination_ref?: string | null;
  status: string;
  scheduled_for?: string | null;
  requested_by: string;
  approved_by?: string | null;
  provider_reference?: string | null;
  executed_at?: string | null;
  last_error?: string | null;
};

type FinanceReadiness = {
  execution_mode: "disabled" | "sandbox" | "live";
  sandbox_ready: boolean;
  live_payout_credentials_configured: boolean;
  live_payout_registry_ready: boolean;
  webhook_secret_configured: boolean;
  live_variable_collection: string;
  secrets_exposed: boolean;
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

type Expense = {
  id: string;
  vendor_id?: string | null;
  reference: string;
  title: string;
  category?: string | null;
  amount: string;
  due_date?: string | null;
  funding_mode?: string | null;
  status: string;
  approval_request_id?: string | null;
  approved_by?: string | null;
};

type Dialog =
  | { kind: "PAYOUT" }
  | { kind: "DECIDE"; approval: Approval; decision: "approve" | "reject" }
  | { kind: "EXECUTE"; instruction: PaymentInstruction };

type Draft = Record<string, string>;

const FINAL_STATES = new Set(["SUCCEEDED", "FAILED", "CANCELLED", "REVERSED"]);

async function runtime<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-runtime/" + path, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.detail === "string" ? body.detail : "Treasury runtime request failed");
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
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function latestInstructionApprovals(approvals: Approval[]) {
  const map = new Map<string, Approval>();
  for (const approval of approvals) {
    if (
      approval.action_type === "PAYMENT_INSTRUCTION_APPROVE" &&
      approval.entity_type === "payment_instruction" &&
      !map.has(approval.entity_id)
    ) {
      map.set(approval.entity_id, approval);
    }
  }
  return map;
}

export function OfficePaymentsWorkspace({
  canStage,
  canDecide,
  canExecute,
}: {
  canStage: boolean;
  canDecide: boolean;
  canExecute: boolean;
}) {
  const [instructions, setInstructions] = useState<PaymentInstruction[]>([]);
  const [readiness, setReadiness] = useState<FinanceReadiness>();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>();
  const [draft, setDraft] = useState<Draft>({});
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const fetchRecords = useCallback(() => Promise.all([
    runtime<PaymentInstruction[]>("finance/payment-instructions"),
    runtime<FinanceReadiness>("finance/readiness"),
    runtime<Approval[]>("approvals"),
    runtime<Expense[]>("finance/expenses"),
  ]), []);

  const applyRecords = useCallback(([nextInstructions, nextReadiness, nextApprovals, nextExpenses]: [PaymentInstruction[], FinanceReadiness, Approval[], Expense[]]) => {
    setInstructions(nextInstructions);
    setReadiness(nextReadiness);
    setApprovals(nextApprovals);
    setExpenses(nextExpenses);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      applyRecords(await fetchRecords());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load treasury controls");
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
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load treasury controls");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyRecords, fetchRecords]);

  const approvalByInstruction = useMemo(() => latestInstructionApprovals(approvals), [approvals]);
  const approvedExpenses = expenses.filter((expense) => expense.status === "APPROVED" && Boolean(expense.vendor_id));
  const pendingCount = instructions.filter((item) => !FINAL_STATES.has(item.status)).length;
  const completedValue = instructions
    .filter((item) => item.status === "SUCCEEDED")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

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
      if (dialog.kind === "PAYOUT") {
        await runtime("finance/payouts", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({
            expense_id: draft.expense_id,
            provider: draft.provider || "RAZORPAYX",
            provider_destination_ref: draft.provider_destination_ref,
            amount: draft.amount ? Number(draft.amount) : undefined,
            scheduled_for: draft.scheduled_for ? new Date(draft.scheduled_for).toISOString() : undefined,
          }),
        });
        await refreshAfter("Payout instruction staged. No provider execution has occurred; independent approval is still required.");
      } else if (dialog.kind === "DECIDE") {
        await runtime("approvals/" + encodeURIComponent(dialog.approval.id) + "/" + dialog.decision, {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({ reason: draft.reason || undefined }),
        });
        await refreshAfter(`Payment approval request ${dialog.decision === "approve" ? "approved" : "rejected"} through the maker-checker workflow.`);
      } else {
        const required = readiness?.execution_mode === "live" ? "EXECUTE LIVE" : "EXECUTE";
        if ((draft.confirmation || "").trim().toUpperCase() !== required) {
          throw new Error(`Type ${required} to confirm provider execution`);
        }
        await runtime("finance/payment-instructions/" + encodeURIComponent(dialog.instruction.id) + "/execute", {
          method: "POST",
          headers: mutationHeaders(),
          body: "{}",
        });
        await refreshAfter(readiness?.execution_mode === "live"
          ? "Live provider execution request submitted. Refresh/provider events remain authoritative for final status."
          : "Sandbox payment instruction executed through the canonical treasury runtime.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Treasury action failed");
    } finally {
      setBusy(false);
    }
  }

  async function finalizeApproval(instruction: PaymentInstruction) {
    setBusy(true);
    setError(undefined);
    try {
      await runtime("finance/payment-instructions/" + encodeURIComponent(instruction.id) + "/approve", {
        method: "POST",
        headers: mutationHeaders(),
        body: "{}",
      });
      await refreshAfter("Approved maker-checker decision applied to the payment instruction.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Instruction approval could not be applied");
    } finally {
      setBusy(false);
    }
  }

  const executionMode = readiness?.execution_mode || "disabled";
  const executionEnabled = executionMode !== "disabled";

  return <section className={styles.shell}>
    <header className={styles.hero}>
      <div>
        <p>TREASURY · PAYMENT CONTROL</p>
        <h2>Stage, independently approve, and explicitly execute payment instructions without hiding provider state.</h2>
        <span>Creating a payout instruction does not move money. Provider execution is a separate action and remains fail-closed when finance execution mode is disabled.</span>
      </div>
      <div className={styles.mode} data-mode={executionMode}>
        <ShieldCheck />
        <span>Execution mode</span>
        <b>{executionMode.toUpperCase()}</b>
      </div>
    </header>

    <div className={styles.toolbar}>
      <button type="button" onClick={() => void load()} disabled={loading || busy}><RefreshCw /> Refresh</button>
      {canStage ? <button type="button" disabled={busy || !approvedExpenses.length} onClick={() => { setDraft({ provider: "RAZORPAYX" }); setDialog({ kind: "PAYOUT" }); }}><Send /> Stage payout</button> : null}
    </div>

    {notice ? <div className={styles.notice}><BadgeCheck />{notice}</div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}

    {loading ? <div className={styles.state}><LoaderCircle className={styles.spin} />Loading canonical treasury controls…</div> : <>
      <div className={styles.metrics}>
        <article><span>Payment instructions</span><b>{instructions.length}</b></article>
        <article><span>Open / processing</span><b>{pendingCount}</b></article>
        <article><span>Succeeded value</span><b>{money(completedValue)}</b></article>
        <article><span>Approved payout expenses</span><b>{approvedExpenses.length}</b></article>
      </div>

      <section className={styles.readiness}>
        <article data-ready={executionMode !== "disabled"}><WalletCards /><div><b>Execution mode</b><span>{executionMode === "disabled" ? "Provider execution is blocked." : executionMode === "sandbox" ? "Sandbox execution is enabled." : "Live execution is enabled; confirmations can create real provider requests."}</span></div></article>
        <article data-ready={Boolean(readiness?.live_payout_registry_ready)}><ShieldCheck /><div><b>RazorpayX registry</b><span>{readiness?.live_payout_registry_ready ? "Ready in integration registry." : "Not marked ready."}</span></div></article>
        <article data-ready={Boolean(readiness?.live_payout_credentials_configured)}><BadgeCheck /><div><b>Live payout credentials</b><span>{readiness?.live_payout_credentials_configured ? "Configured in deployment secrets." : "Not configured."}</span></div></article>
        <article data-ready={Boolean(readiness?.webhook_secret_configured)}><Clock3 /><div><b>Provider webhook</b><span>{readiness?.webhook_secret_configured ? "Verification secret configured." : "Verification secret not configured."}</span></div></article>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHead}>
          <div><p>PAYMENT INSTRUCTIONS</p><h3>Staged, approved, processing and final provider states</h3></div>
          <span>The latest canonical status is shown. Live execution requires explicit confirmation and provider readiness.</span>
        </header>
        <div className={styles.cards}>
          {instructions.map((instruction) => {
            const approval = approvalByInstruction.get(instruction.id);
            const scheduledFuture = Boolean(instruction.scheduled_for && Date.parse(instruction.scheduled_for) > Date.now());
            return <article className={styles.card} key={instruction.id}>
              <header><div><small>{instruction.direction} · {instruction.provider}</small><h4>{money(instruction.amount)}</h4></div><em data-status={instruction.status}>{instruction.status}</em></header>
              <dl>
                <div><dt>Instruction</dt><dd>{instruction.id}</dd></div>
                <div><dt>Expense / allocation</dt><dd>{instruction.expense_id || instruction.allocation_id || "—"}</dd></div>
                <div><dt>Scheduled</dt><dd>{dateTime(instruction.scheduled_for)}</dd></div>
                <div><dt>Requested by</dt><dd>{instruction.requested_by}</dd></div>
                <div><dt>Approved by</dt><dd>{instruction.approved_by || "—"}</dd></div>
                <div><dt>Provider reference</dt><dd>{instruction.provider_reference || "—"}</dd></div>
              </dl>
              {instruction.last_error ? <div className={styles.inlineError}><CircleAlert />{instruction.last_error}</div> : null}
              {approval ? <div className={styles.approval}><ShieldCheck /><div><b>Maker-checker · {approval.status}</b><span>{approval.id} · requires {approval.required_role}</span>{approval.decided_by ? <span>Decided by {approval.decided_by}</span> : null}</div></div> : null}
              <div className={styles.actions}>
                {approval?.status === "PENDING" && canDecide ? <>
                  <button type="button" disabled={busy} onClick={() => { setDraft({}); setDialog({ kind: "DECIDE", approval, decision: "approve" }); }}><BadgeCheck /> Approve request</button>
                  <button type="button" disabled={busy} onClick={() => { setDraft({}); setDialog({ kind: "DECIDE", approval, decision: "reject" }); }}><CircleAlert /> Reject</button>
                </> : null}
                {approval?.status === "APPROVED" && instruction.status !== "APPROVED" && !FINAL_STATES.has(instruction.status) && canStage
                  ? <button type="button" disabled={busy} onClick={() => void finalizeApproval(instruction)}><ShieldCheck /> Apply approval</button>
                  : null}
                {instruction.status === "APPROVED" && canExecute && executionEnabled && !scheduledFuture
                  ? <button type="button" disabled={busy} onClick={() => { setDraft({}); setDialog({ kind: "EXECUTE", instruction }); }}><PlayCircle /> Execute {executionMode}</button>
                  : null}
                {instruction.status === "APPROVED" && scheduledFuture ? <span className={styles.scheduled}><Clock3 /> Scheduled for {dateTime(instruction.scheduled_for)}</span> : null}
                {instruction.status === "APPROVED" && !executionEnabled ? <span className={styles.scheduled}><ShieldCheck /> Execution disabled by runtime configuration</span> : null}
              </div>
            </article>;
          })}
          {!instructions.length ? <div className={styles.empty}>No payment instructions have been staged.</div> : null}
        </div>
      </section>
    </>}

    {dialog ? <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && setDialog(undefined)}>
      <form className={styles.dialog} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><small>TREASURY CONTROL</small><h3>{dialog.kind === "PAYOUT" ? "Stage payout instruction" : dialog.kind === "DECIDE" ? `${dialog.decision === "approve" ? "Approve" : "Reject"} payment request` : `Execute ${executionMode} instruction`}</h3></div><button type="button" aria-label="Close" disabled={busy} onClick={() => setDialog(undefined)}><X /></button></header>
        {dialog.kind === "PAYOUT" ? <>
          <label>Approved expense<select required value={draft.expense_id || ""} onChange={(event) => setDraft({ ...draft, expense_id: event.target.value })}><option value="">Select approved expense</option>{approvedExpenses.map((expense) => <option key={expense.id} value={expense.id}>{expense.reference} · {expense.title} · {money(expense.amount)}</option>)}</select></label>
          <div className={styles.two}><label>Provider<input required minLength={2} maxLength={50} value={draft.provider || "RAZORPAYX"} onChange={(event) => setDraft({ ...draft, provider: event.target.value.toUpperCase() })} /></label><label>Amount (optional)<input type="number" min="0.01" step="0.01" value={draft.amount || ""} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label></div>
          <label>Provider destination reference<input required minLength={2} maxLength={200} value={draft.provider_destination_ref || ""} onChange={(event) => setDraft({ ...draft, provider_destination_ref: event.target.value })} /><small>Use the provider-side destination/fund-account reference, never raw bank credentials.</small></label>
          <label>Schedule (optional)<input type="datetime-local" value={draft.scheduled_for || ""} onChange={(event) => setDraft({ ...draft, scheduled_for: event.target.value })} /></label>
          <p className={styles.warning}>Staging creates a payment instruction and approval request only. It does not contact the payout provider.</p>
        </> : dialog.kind === "DECIDE" ? <>
          <p>Approval {dialog.approval.id} · requires {dialog.approval.required_role}</p>
          <label>Decision reason<textarea value={draft.reason || ""} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} /></label>
          <p className={styles.warning}>The requester cannot decide their own approval. The backend enforces maker-checker separation independently of this interface.</p>
        </> : <>
          <p>Instruction <b>{dialog.instruction.id}</b> · {dialog.instruction.provider} · {money(dialog.instruction.amount)}.</p>
          <div className={styles.executionWarning} data-live={executionMode === "live"}><CircleAlert /><div><b>{executionMode === "live" ? "LIVE PROVIDER EXECUTION" : "SANDBOX EXECUTION"}</b><span>{executionMode === "live" ? "This action can submit a real payout request to the configured provider." : "This action records a sandbox provider attempt; it does not move real money."}</span></div></div>
          <label>Confirmation<input required autoComplete="off" value={draft.confirmation || ""} onChange={(event) => setDraft({ ...draft, confirmation: event.target.value })} placeholder={executionMode === "live" ? "Type EXECUTE LIVE" : "Type EXECUTE"} /></label>
        </>}
        <footer><button type="button" disabled={busy} onClick={() => setDialog(undefined)}>Cancel</button><button type="submit" disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <BadgeCheck />}Confirm</button></footer>
      </form>
    </div> : null}
  </section>;
}
