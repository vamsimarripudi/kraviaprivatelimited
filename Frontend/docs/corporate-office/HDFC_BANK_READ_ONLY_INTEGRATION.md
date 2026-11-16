# KRAVIA Office — HDFC current account (read-only connection plan)

**Status at audit (2026-11-15, Asia/Kolkata)**

- Production `BANK_FEED` registry row: `NOT_CONFIGURED`.
- No masked bank-account references are yet registered in KRAVIA Office's production `bank_accounts` table.
- No HDFC-issued API credentials, bank client certificates, approved static IPs, bank API subscription or signed bank data-access agreement have been verified here.
- HDFC must not be called CONNECTED or OPERATIONAL based on a successful local CSV import.

## Available now in the codebase (not the HDFC API)

Use `Office → Finance → Banking`, register a **masked** HDFC company account, and use **Import HDFC CSV**.

1. Sign in as an authorised Founder/Finance/CA user with the requisite first-party Office authentication and access.
2. Open the official HDFC ENet business portal independently. Export the relevant current-account period as CSV. Never share HDFC username, password, OTP, PIN, full account number or token with KRAVIA Office or ChatGPT.
3. Select only the previously reviewed, active, INR-denominated HDFC company account. Upload CSV (up to 1 MB, no more than 200 rows per batch).
4. Preview bank refs, dates, amounts, new rows, duplicates, conflicts and malformed rows. Missing references and invalid rows are **blocked** (must be resolved manually).
5. Explicitly confirm the reviewed file. The API recomputes a SHA-256 digest and parses it again; the DB writes only new transaction evidence, adds an audit entry, and leaves matching as UNMATCHED for Finance/CA review.
6. Resubmitting the exact approved file is idempotent. Overlapping statement dates use account/reference/amount deduplication, and ambiguous collisions require review. Original raw CSV and bank credentials are not persisted.
7. Do not interpret this as a real-time bank sync or a bank-validated/cryptographically signed statement.

**Permissions and boundaries:** Owner, Finance and CA may preview and confirm; company records use masked account identifiers only; this adapter never initiates NEFT/RTGS/IMPS/UPI, payments, mandates, beneficiary registration or bank instructions.

## Official HDFC API route (future production integration)

HDFC Bank's current official API catalog lists:

- **Corporate Aggregator Large Statement Generation v1** (generate intraday/historical statements, query job status, download report).
- **Corporate CASA Basic Balance Inquiry** (account balances/basic information).

Links:
- https://developer.hdfc.bank.in/accounts-and-deposits
- https://developer.hdfc.bank.in/api-category-landing/33
- https://developer.hdfc.bank.in/get-started
- https://developer.hdfc.bank.in/faqs?field_faq_tags_target_id=26
- https://www.hdfc.bank.in/msme-banking/payments-and-collections/e-net-services

**Required bank-side activation (cannot be simulated):**

1. Confirm KRAVIA's business current account and whether corporate/SME API Banking is available for this specific customer and company-use case.
2. Ask the HDFC relationship manager or official API Portal team to approve a **read-only statements and balance API** use case for KRAVIA's own internal treasury/reconciliation system, explicitly excluding payment initiation and third-party resale.
3. Register KRAVIA as an API developer/partner in the **official** HDFC API Portal, select the approved products, request UAT sandbox access, and obtain the official technical contract. No assumed endpoints, response fields or auth values.
4. HDFC's API FAQs require a **CA-signed mutual-TLS certificate**, bank-side certificate whitelisting and a **bank-approved static egress IP** for partner APIs. Do not send private keys; bank approves partner public certificate chain. Separate approved client IDs/secrets only after registration.
5. Verify subscription charges/quotas, business consent/authority, account access delegation, security/privacy, rate limits, IP/certificate rotation, audit and retention requirements.
6. Validate UAT with bank-approved synthetic data: read-only auth, refresh/expiry, pagination, backfills, duplicate resolution, corrections, zero-transaction periods, timing and revocation. Prove no access outside KRAVIA's specific accounts.
7. Only then configure vault-managed production secrets, mTLS egress and monitoring, add a bank-specific signed API adapter, and change registry status to READY after external evidence. Never update status to READY just because KRAVIA's UI is implemented.

**RBI boundary:** An Account Aggregator is a separate regulated, consent-based model. KRAVIA must not treat AA data access as a bypass for HDFC's developer program or bank authorization.

Official RBI reference: https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12936

**Evidence checklist for Office readiness:** HDFC approval reference, UAT credentials issued privately, approved product name & technical pack, verified callback/static-IP/mTLS details, account scope, signed acceptance, current external status, and a production read-only health check.

This file contains no account numbers, API secrets, bank passwords, personal customer data or live statement records.
