# KRAVIA Office — Finance & Ownership

Finance & Ownership is an internal bounded domain of KRAVIA Office. It keeps statutory ownership, expense funding, collections and company payouts separate while presenting them in one controlled workspace.

## Invariants

1. Share ownership is derived only from the append-only share ledger.
2. Expense contributions, mandates and payments never alter ownership.
3. Share changes and transfers require maker-checker approval before posting.
4. Transfers are atomic: the source debit and destination credit post in one database transaction.
5. Expenses and payment instructions require independent approval.
6. Money is persisted as integer paise.
7. Every outbound or collection instruction has an idempotency key.
8. Reuse of an idempotency key for different business input is rejected.
9. Mandate amount and validity limits are rechecked at execution time.
10. Live payment execution is fail-closed until provider configuration is explicitly enabled.
11. Provider webhooks are signature-verified and de-duplicated before financial state changes.
12. Secrets, bank passwords, OTPs and UPI PINs are never stored in business records or source control.

## Ownership lifecycle

`Shareholder/Class master -> staged issue/adjustment -> approval -> append-only ledger`

Transfers use a dedicated atomic workflow:

`Transfer request -> approval -> TRANSFER_OUT + TRANSFER_IN in one transaction`

The current cap table is computed from posted ledger balances. The application does not hard-code shareholder identity or legal evidence into source control; controlled records are loaded through the authenticated Office UI/API and reference the approved evidence source.

## Expense funding lifecycle

`Expense -> independent approval -> funding policy -> contribution call -> exact paise allocations -> authorised mandate -> payment instruction -> independent approval -> execution -> reconciliation`

Funding policies can follow current ownership or an explicitly approved 10,000-basis-point custom allocation. Rounding residue is deterministically assigned so every contribution call reconciles exactly to the expense total.

## Payout lifecycle

`Vendor expense -> independent approval -> payout instruction -> independent approval -> provider execution -> webhook/reconciliation -> paid`

Sandbox execution is fully supported for testing. RazorpayX payout execution is available only in `live` mode with credentials and an operational integration-registry record. Variable recurring collections remain provider-gated until the merchant account/use case and recurring-payment adapter are approved and configured.

## Runtime

The canonical ASGI entrypoint is:

```bash
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

`backend.app` attaches Finance & Ownership to the existing KRAVIA Office API and serves the Office web UI on the same origin. The finance workspace is available at `/finance.html`.

## Execution modes

- `disabled`: default; no provider execution.
- `sandbox`: deterministic local payment execution for QA/E2E.
- `live`: permits only explicitly implemented and readiness-gated live adapters.

Live credentials are read from the environment/secret manager only. See `backend/.env.example`.
